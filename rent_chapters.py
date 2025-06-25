import os
import time
import logging
from datetime import datetime, timedelta
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

    return
# 로깅 설정
logger = logging.getLogger(__name__)
username = os.environ.get('RIDIBOOKS_USERNAME')
password = os.environ.get('RIDIBOOKS_PASSWORD')
logger.info(f"Username provided: {'Yes' if username else 'No'}")
logger.info(f"Password provided: {'Yes' if password else 'No'}")
RIDIBOOKS_USERNAME: ${{ secrets.RIDIBOOKS_USERNAME }}
RIDIBOOKS_PASSWORD: ${{ secrets.RIDIBOOKS_PASSWORD }}
if not username or not password:
    logger.error("사용자 이름 또는 비밀번호가 제공되지 않음")

def login(driver, username, password):
    """리디북스에 로그인"""
    driver.get('https://ridibooks.com/account/login')
    try:
        wait = WebDriverWait(driver, 10)
        username_field = wait.until(EC.presence_of_element_located((By.ID, 'id')))
        username_field.send_keys(username)
        password_field = driver.find_element(By.ID, 'password')
        password_field.send_keys(password)
        login_button = driver.find_element(By.XPATH, '//button[@type="submit"]')
        login_button.click()
        wait.until(EC.presence_of_element_located((By.ID, 'user_profile')))  # 로그인 후 요소로 변경
        logger.info("로그인 성공")
    except Exception as e:
        logger.error(f"로그인 실패: {e}")
        raise

def fetch_notifications(driver):
    """지난 24시간 내 웹소설 관련 알림 가져오기"""
    driver.get('https://ridibooks.com/notification?tab=3')
    try:
        wait = WebDriverWait(driver, 10)
        wait.until(EC.presence_of_element_located((By.CLASS_NAME, 'notification_container')))  # 실제 클래스명으로 변경
        notifications = driver.find_elements(By.CLASS_NAME, 'notification_item')  # 실제 클래스명으로 변경
        relevant_links = []
        current_time = datetime.now()
        for notif in notifications:
            try:
                timestamp_str = notif.find_element(By.CLASS_NAME, 'timestamp').text  # 실제 클래스명으로 변경
                # 타임스탬프 형식은 웹사이트에 따라 조정 (예: '2025년 6월 22일 14:00')
                timestamp = datetime.strptime(timestamp_str, '%Y년 %m월 %d일 %H:%M')
                if current_time - timestamp <= timedelta(hours=24):
                    link = notif.find_element(By.TAG_NAME, 'a').get_attribute('href')
                    if 'webnovel' in link:  # 웹소설 링크 확인
                        relevant_links.append(link)
            except Exception as e:
                logger.error(f"알림 처리 오류: {e}")
                continue
        logger.info(f"지난 24시간 내 관련 알림 {len(relevant_links)}개 발견")
        return relevant_links
    except Exception as e:
        logger.error(f"알림 가져오기 실패: {e}")
        raise

def rent_chapter(driver, chapter_url):
    """주어진 URL의 챕터 대여"""
    driver.get(chapter_url)
    try:
        wait = WebDriverWait(driver, 10)
        wait.until(EC.element_to_be_clickable((By.XPATH, '//button[contains(text(), "대여")]')))  # 실제 버튼으로 변경
        rent_button = driver.find_element(By.XPATH, '//button[contains(text(), "대여")]')
        rent_button.click()
        time.sleep(1)  # 대여 처리 대기
        logger.info(f"챕터 대여 성공: {chapter_url}")
    except Exception as e:
        logger.error(f"챕터 대여 실패 {chapter_url}: {e}")
        raise

def main():
    """메인 함수: 로그인, 알림 확인, 챕터 대여"""
    username = os.environ.get('RIDIBOOKS_USERNAME')
    password = os.environ.get('RIDIBOOKS_PASSWORD')
    if not username or not password:
        logger.error("사용자 이름 또는 비밀번호가 제공되지 않음")
        return

    # Chrome 옵션 설정
    options = webdriver.ChromeOptions()
    options.add_argument('--headless')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36')

    # WebDriver 생성
    driver = webdriver.Chrome(options=options)
    try:
        login(driver, username, password)
        chapter_links = fetch_notifications(driver)
        for link in chapter_links:
            rent_chapter(driver, link)
            time.sleep(2)  # 봇 탐지 방지를 위한 지연
    except Exception as e:
        logger.error(f"스크립트 실행 오류: {e}")
    finally:
        driver.quit()
        logger.info("브라우저 종료")

if __name__ == '__main__':
    main()
