import requests
from app.core.config import settings

class AligoService:
    def __init__(self):
        self.url = "https://apis.aligo.in/send/"
        self.key = settings.ALIGO_KEY
        self.user_id = settings.ALIGO_USER_ID
        self.sender = settings.ALIGO_SENDER
        self.testmode_yn = settings.ALIGO_TESTMODE_YN

    def send_message(self, receiver, destination, msg, title, rdate=None, rtime=None, image_path=None):
        # Prepare the payload
        payload = {
            'key': self.key,
            'user_id': self.user_id,
            'sender': self.sender,
            'receiver': receiver,  # e.g., "01111111111,01111111112"
            'destination': destination,  # e.g., "01111111111|홍길동,01111111112|아무개"
            'msg': msg,
            'title': title,
            'testmode_yn': self.testmode_yn
        }
        
        if rdate:
            payload['rdate'] = rdate  # e.g., "20241031"
        if rtime:
            payload['rtime'] = rtime  # e.g., "0106"

        files = {}
        if image_path:
            files['image'] = open(image_path, 'rb')  # Open the image file in binary mode

        # Execute the HTTP request
        response = requests.post(self.url, data=payload, files=files)
        
        # Handle the response
        if response.status_code == 200:
            result = response.json()
            return self.handle_response(result)
        else:
            return {'result_code': response.status_code, 'message': 'HTTP request failed.'}
    
    def handle_response(self, result):
        if result['result_code'] == '1':
            return {
                'success': True,
                'msg_id': result.get('msg_id'),
                'success_count': result.get('success_cnt'),
                'error_count': result.get('error_cnt')
            }
        else:
            return {
                'success': False,
                'message': result.get('message', 'Unknown error occurred.')
            }

# Example usage:
# aligo = AligoService()
# response = aligo.send_message(
#     receiver='01111111111,01111111112',
#     destination='01111111111|홍길동,01111111112|아무개',
#     msg='%고객명%님! 안녕하세요. API TEST SEND',
#     title='API TEST 입니다',
#     rdate='20241031',
#     rtime='0106',
#     testmode_yn='Y',
#     image_path='localfilename'
# )
# print(response)
