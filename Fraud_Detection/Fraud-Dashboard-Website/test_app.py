import unittest

from app import create_app


class FraudDashboardApiTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.client = self.app.test_client()

    def test_summary_endpoint(self):
        response = self.client.get('/api/summary')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertIn('total_transactions', data)
        self.assertIn('fraud_rate', data)

    def test_transactions_endpoint(self):
        response = self.client.get('/api/transactions')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertIn('transactions', data)
        self.assertGreaterEqual(len(data['transactions']), 1)

    def test_predict_endpoint(self):
        payload = {
            'amount': 5200,
            'hour': 22,
            'merchant': 'Travel',
            'foreign': True,
            'location_mismatch': True,
            'device_trust_score': 0.36,
            'velocity_last_24h': 6,
            'cardholder_age': 28,
        }
        response = self.client.post('/api/predict', json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertIn('risk_score', data)
        self.assertIn('fraud_probability', data)


if __name__ == '__main__':
    unittest.main()
