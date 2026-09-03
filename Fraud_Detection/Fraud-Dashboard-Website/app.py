from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

MERCHANT_CATEGORIES = ['Grocery', 'Travel', 'Food', 'Electronics', 'Online', 'Other']
TRANSACTION_TYPES = ['Card', 'Cash', 'Online']


def clamp(value, minimum, maximum):
    return max(minimum, min(maximum, value))


def risk_level_from_score(score):
    if score <= 30:
        return 'Low'
    if score <= 60:
        return 'Medium'
    if score <= 80:
        return 'High'
    return 'Critical'


def generate_factors(payload):
    factors = []
    if payload.get('device_trust_score', 1) < 0.5:
        factors.append('Low device trust score')
    if payload.get('hour', 12) >= 22 or payload.get('hour', 12) <= 4:
        factors.append('Unusual transaction hour')
    if payload.get('amount', 0) > 4000:
        factors.append('High transaction value')
    if payload.get('velocity_last_24h', 0) > 5:
        factors.append('High transaction velocity')
    if payload.get('foreign'):
        factors.append('Cross-border transaction')
    if payload.get('location_mismatch'):
        factors.append('Location mismatch')
    if payload.get('merchant') in {'Travel', 'Electronics'}:
        factors.append('Merchant profile mismatch')
    return factors[:4]


def build_transactions(total=1200):
    rows = []
    for i in range(total):
        is_fraud = i < 487
        merchant = MERCHANT_CATEGORIES[i % len(MERCHANT_CATEGORIES)]
        amount_base = 650 if is_fraud else 240
        amount = round(amount_base + ((i * 17) % 4200) + (1100 if merchant == 'Travel' else 900 if merchant == 'Electronics' else 0))
        hour = (i * 7 + (9 if is_fraud else 5)) % 24
        foreign = i % 5 == 0 or (is_fraud and i % 3 == 0)
        location_mismatch = (is_fraud and i % 2 == 0) or (not is_fraud and i % 5 == 0)
        device_trust_score = clamp((0.52 + ((i * 0.011) % 0.46) + (-0.18 if is_fraud else 0.12)), 0.08, 0.99)
        velocity_last_24h = clamp((7 if is_fraud else 2) + (i % 5), 0, 15)
        cardholder_age = clamp(22 + ((i * 5) % 56) + (2 if is_fraud else 0), 18, 82)
        transaction_type = TRANSACTION_TYPES[(i + (1 if is_fraud else 2)) % len(TRANSACTION_TYPES)]

        risk_score = clamp(
            14 +
            (15 if amount > 4000 else 0) +
            (18 if hour >= 22 or hour <= 4 else 0) +
            (12 if foreign else 0) +
            (18 if location_mismatch else 0) +
            (17 if device_trust_score < 0.5 else 0) +
            (14 if velocity_last_24h > 5 else 0) +
            (9 if merchant in {'Travel', 'Electronics'} else 0) +
            (18 if is_fraud else -8),
            0,
            100,
        )

        fraud_probability = clamp((0.54 if is_fraud else 0.18) + (risk_score / 120), 0.02, 0.99)
        legitimate_probability = clamp(1 - fraud_probability, 0.01, 0.98)
        status = 'Fraud' if risk_score >= 70 else 'Review' if risk_score >= 45 else 'Safe'

        rows.append({
            'id': f'TXN-{str(i + 1).zfill(5)}',
            'amount': amount,
            'merchant': merchant,
            'hour': hour,
            'transaction_type': transaction_type,
            'foreign': foreign,
            'location_mismatch': location_mismatch,
            'device_trust_score': round(device_trust_score, 2),
            'velocity_last_24h': velocity_last_24h,
            'cardholder_age': cardholder_age,
            'is_fraud': is_fraud,
            'risk_score': round(risk_score),
            'fraud_probability': round(fraud_probability * 100, 1),
            'legitimate_probability': round(legitimate_probability * 100, 1),
            'status': status,
            'risk_level': risk_level_from_score(risk_score),
            'location': 'Foreign' if foreign else 'Domestic',
            'risk_class': 'low' if risk_score <= 30 else 'medium' if risk_score <= 60 else 'high' if risk_score <= 80 else 'critical',
            'model_factors': generate_factors({
                'amount': amount,
                'hour': hour,
                'foreign': foreign,
                'location_mismatch': location_mismatch,
                'device_trust_score': device_trust_score,
                'velocity_last_24h': velocity_last_24h,
                'merchant': merchant,
                'is_fraud': is_fraud,
            }),
        })
    return rows


def create_app():
    app = Flask(__name__)
    CORS(app)
    transactions = build_transactions()

    @app.get('/')
    def index():
        return send_from_directory(app.root_path, 'index.html')

    @app.get('/styles.css')
    def styles():
        return send_from_directory(app.root_path, 'styles.css')

    @app.get('/script.js')
    def script():
        return send_from_directory(app.root_path, 'script.js')

    @app.get('/api/summary')
    def summary():
        total = len(transactions)
        fraud_count = sum(1 for t in transactions if t['is_fraud'])
        safe_count = total - fraud_count
        total_amount = sum(t['amount'] for t in transactions)
        avg_amount = total_amount / total if total else 0
        avg_risk = sum(t['risk_score'] for t in transactions) / total if total else 0
        fraud_rate = (fraud_count / total) * 100 if total else 0

        return jsonify({
            'total_transactions': total,
            'fraud_transactions': fraud_count,
            'safe_transactions': safe_count,
            'total_amount': total_amount,
            'average_amount': round(avg_amount, 2),
            'average_risk_score': round(avg_risk, 2),
            'fraud_rate': round(fraud_rate, 2),
        })

    @app.get('/api/transactions')
    def get_transactions():
        return jsonify({'transactions': transactions})

    @app.post('/api/predict')
    def predict():
        payload = request.get_json(silent=True) or {}
        amount = float(payload.get('amount', 0))
        hour = int(payload.get('hour', 12))
        merchant = payload.get('merchant', 'Other')
        foreign = bool(payload.get('foreign', False))
        location_mismatch = bool(payload.get('location_mismatch', False))
        device_trust_score = float(payload.get('device_trust_score', 1.0))
        velocity_last_24h = int(payload.get('velocity_last_24h', 0))

        risk_score = clamp(
            14 +
            (15 if amount > 4000 else 0) +
            (18 if hour >= 22 or hour <= 4 else 0) +
            (12 if foreign else 0) +
            (18 if location_mismatch else 0) +
            (17 if device_trust_score < 0.5 else 0) +
            (14 if velocity_last_24h > 5 else 0) +
            (9 if merchant in {'Travel', 'Electronics'} else 0),
            0,
            100,
        )

        fraud_probability = clamp((0.32 + (risk_score / 170)) * 100, 0, 99.9)
        legitimate_probability = clamp(100 - fraud_probability, 0, 99.9)
        level = risk_level_from_score(risk_score)
        recommendation = (
            'Block or manually review this transaction.' if risk_score >= 70
            else 'Review with additional verification.' if risk_score >= 45
            else 'Allow transaction with standard monitoring.'
        )

        return jsonify({
            'risk_score': round(risk_score),
            'risk_level': level,
            'fraud_probability': round(fraud_probability, 1),
            'legitimate_probability': round(legitimate_probability, 1),
            'recommendation': recommendation,
            'factors': generate_factors({
                'amount': amount,
                'hour': hour,
                'foreign': foreign,
                'location_mismatch': location_mismatch,
                'device_trust_score': device_trust_score,
                'velocity_last_24h': velocity_last_24h,
                'merchant': merchant,
            })
        })

    return app


app = create_app()


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
