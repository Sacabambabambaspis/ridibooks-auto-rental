import os
import time
import logging
from datetime import datetime, timedelta
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def login(driver, username, password):
    driver.get('https://ridibooks.com/account/login')
    try:
        WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.ID, 'login_id')))
        driver.find_element(By.ID, 'login_id').send_keys(username)  # Replace 'login_id' with actual ID
        driver.find_element(By.ID, 'login_pw').send_keys(password)  # Replace 'login_pw' with actual ID
        driver.find_element(By.ID, 'login_submit').click()          # Replace 'login_submit' with actual ID
        WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.ID, 'some_element_after_login')))
        logger.info("Logged in successfully")
    except Exception as e:
        logger.error(f"Login failed: {e}")
        raise

def fetch_notifications(driver):
    driver.get('https://ridibooks.com/notification?tab=3')  # Adjust URL if needed
    try:
        WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.CLASS_NAME, 'notification_container')))
        notifications = driver.find_elements(By.CLASS_NAME, 'notification_item')  # Replace with actual class
        relevant_links = []
        current_time = datetime.now()
        for notif in notifications:
            timestamp_str = notif.find_element(By.CLASS_NAME, 'timestamp').text  # Replace with actual class
            # Adjust timestamp format based on Ridibooks notification (e.g., '2023-10-25 14:30:00')
            timestamp = datetime.strptime(timestamp_str, '%Y-%m-%d %H:%M:%S')
            if current_time - timestamp <= timedelta(hours=24):
                link = notif.find_element(By.TAG_NAME, 'a').get_attribute('href')
                if 'webnovel' in link:  # Filter for web novels
                    relevant_links.append(link)
        logger.info(f"Found {len(relevant_links)} relevant notifications within the last 24 hours")
        return relevant_links
    except Exception as e:
        logger.error(f"Failed to fetch notifications: {e}")
        raise

def rent_chapter(driver, chapter_url):
    driver.get(chapter_url)
    try:
        WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.ID, 'rental_button')))
        driver.find_element(By.ID, 'rental_button').click()  # Replace 'rental_button' with actual ID
        time.sleep(1)  # Wait for rental to process
        logger.info(f"Rented chapter: {chapter_url}")
    except Exception as e:
        logger.error(f"Failed to rent chapter {chapter_url}: {e}")
        raise

def main():
    # Configure headless Chrome for GitHub Actions
    options = webdriver.ChromeOptions()
    options.add_argument('--headless')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.binary_location = '/usr/bin/chromium-browser'
    driver = webdriver.Chrome(executable_path='/usr/bin/chromedriver', options=options)
    
    # Get credentials from environment variables
    username = os.environ.get('RIDIBOOKS_USERNAME')
    password = os.environ.get('RIDIBOOKS_PASSWORD')
    
    if not username or not password:
        logger.error("Username or password not provided in environment variables")
        return
    
    try:
        login(driver, username, password)
        chapter_links = fetch_notifications(driver)
        for link in chapter_links:
            rent_chapter(driver, link)
            time.sleep(2)  # Delay to mimic human behavior and avoid detection
    except Exception as e:
        logger.error(f"Script execution failed: {e}")
    finally:
        driver.quit()
        logger.info("Browser closed")

if __name__ == '__main__':
    main()
