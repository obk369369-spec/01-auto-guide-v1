# CLOUD_SERVER_LAYER_STATUS
time=20260607_153621

GitHub=PASS if gh auth status is Logged in
OneDriveFolder=True
GoogleDriveFolder=False
GoogleMyDriveFolder=False

판정:
OneDriveFolder=True 이면 OneDrive 연결 PASS 후보
GoogleDriveFolder=True 또는 GoogleMyDriveFolder=True 이면 Google Drive 연결 PASS 후보
False 이면 로그인/설치 HOLD

목표:
USB 없이 외부 PC에서도 GitHub + Cloud 기준으로 상태 확인 가능하게 전환
