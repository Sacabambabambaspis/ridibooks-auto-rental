const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

class RidiBooksAutoRental {
    constructor() {
        this.browser = null;
        this.page = null;
        this.logFile = path.join(__dirname, '../logs', `rental-${new Date().toISOString().split('T')[0]}.log`);
    }

    async log(message) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}\n`;
        console.log(logMessage.trim());
        
        // 로그 디렉토리 생성
        await fs.mkdir(path.dirname(this.logFile), { recursive: true });
        await fs.appendFile(this.logFile, logMessage);
    }

    async sendTelegramNotification(message) {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const chatId = process.env.TELEGRAM_CHAT_ID;
        
        if (!botToken || !chatId) {
            await this.log('텔레그램 설정이 없어 알림을 보내지 않습니다.');
            return;
        }

        try {
            const fetch = (await import('node-fetch')).default;
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: `🤖 리디북스 자동대여\n${message}`,
                    parse_mode: 'HTML'
                })
            });
        } catch (error) {
            await this.log(`텔레그램 알림 전송 실패: ${error.message}`);
        }
    }

    async init() {
        await this.log('브라우저 초기화 중...');
        
        this.browser = await chromium.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage'
            ]
        });

        this.page = await this.browser.newPage();
        await this.page.setViewportSize({ width: 1280, height: 720 });
        
        // User-Agent 설정
        await this.page.setExtraHTTPHeaders({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });
    }

    async login() {
        await this.log('로그인 시도 중...');
        
        try {
            await this.page.goto('https://ridibooks.com/account/login', {
                waitUntil: 'networkidle',
                timeout: 30000
            });

            // 이메일 입력
            await this.page.waitForSelector('input[name="user_id"]', { timeout: 10000 });
            await this.page.fill('input[name="user_id"]', process.env.RIDI_EMAIL);

            // 비밀번호 입력
            await this.page.waitForSelector('input[name="password"]', { timeout: 10000 });
            await this.page.fill('input[name="password"]', process.env.RIDI_PASSWORD);

            // 로그인 버튼 클릭
            await this.page.click('button[type="submit"]');
            
            // 로그인 완료 대기
            await this.page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 });
            
            await this.log('로그인 성공');
            return true;
        } catch (error) {
            await this.log(`로그인 실패: ${error.message}`);
            return false;
        }
    }

    async checkNotifications() {
        await this.log('알림 확인 중...');
        
        try {
            await this.page.goto('https://ridibooks.com/notification?tab=3', {
                waitUntil: 'networkidle',
                timeout: 30000
            });

            // 알림 목록 대기
            await this.page.waitForSelector('.notification-list, .notification-item, [class*="notification"]', { timeout: 10000 });

            // 24시간 이내의 새로운 알림 찾기
            const notifications = await this.page.evaluate(() => {
                // 다양한 셀렉터로 알림 아이템 찾기
                const possibleSelectors = [
                    '.notification-item',
                    '.notification-list-item',
                    '[data-notification]',
                    '.alert-item',
                    '[class*="notification"]'
                ];
                
                let notificationItems = [];
                for (const selector of possibleSelectors) {
                    const items = document.querySelectorAll(selector);
                    if (items.length > 0) {
                        notificationItems = Array.from(items);
                        break;
                    }
                }

                const newNotifications = [];

                notificationItems.forEach(item => {
                    // 시간 요소 찾기
                    const timeSelectors = [
                        '.notification-time',
                        '.time',
                        '.timestamp',
                        '[class*="time"]'
                    ];
                    
                    let timeElement = null;
                    for (const selector of timeSelectors) {
                        timeElement = item.querySelector(selector);
                        if (timeElement) break;
                    }
                    
                    if (!timeElement) return;

                    const timeText = timeElement.textContent.trim();
                    
                    // 시간 파싱 (예: "2시간 전", "1일 전" 등)
                    const isRecent = timeText.includes('분 전') || 
                                   timeText.includes('시간 전') || 
                                   (timeText.includes('일 전') && parseInt(timeText) === 1);

                    if (isRecent) {
                        // 제목과 링크 찾기
                        const titleSelectors = [
                            '.notification-title',
                            '.title',
                            'h3', 'h4', 'h5',
                            '[class*="title"]'
                        ];
                        
                        let titleElement = null;
                        for (const selector of titleSelectors) {
                            titleElement = item.querySelector(selector);
                            if (titleElement) break;
                        }
                        
                        const linkElement = item.querySelector('a') || item.closest('a');
                        
                        if (titleElement && linkElement) {
                            newNotifications.push({
                                title: titleElement.textContent.trim(),
                                link: linkElement.href,
                                time: timeText
                            });
                        }
                    }
                });

                return newNotifications;
            });

            await this.log(`발견된 새 알림: ${notifications.length}개`);
            return notifications;
        } catch (error) {
            await this.log(`알림 확인 실패: ${error.message}`);
            return [];
        }
    }

    async processNotification(notification) {
        await this.log(`알림 처리 중: ${notification.title}`);
        
        try {
            // 알림 링크로 이동
            await this.page.goto(notification.link, {
                waitUntil: 'networkidle',
                timeout: 30000
            });

            // 기다무 대여 버튼 찾기
            await this.page.waitForTimeout(2000);
            
            const rentalSelectors = [
                '.free-rental-btn',
                '.rental-btn',
                'button[data-rental="free"]',
                '[class*="free"][class*="rental"]',
                'button[class*="free"]',
                '.btn-free-rental'
            ];
            
            let rentalButton = null;
            for (const selector of rentalSelectors) {
                try {
                    rentalButton = await this.page.$(selector);
                    if (rentalButton) break;
                } catch (e) {
                    continue;
                }
            }
            
            if (rentalButton) {
                await rentalButton.click();
                await this.page.waitForTimeout(3000);
                
                // 대여 확인 버튼이 있는지 확인
                const confirmSelectors = [
                    '.confirm-btn',
                    '.modal-confirm',
                    'button[class*="confirm"]',
                    '.btn-confirm'
                ];
                
                for (const selector of confirmSelectors) {
                    try {
                        const confirmButton = await this.page.$(selector);
                        if (confirmButton) {
                            await confirmButton.click();
                            await this.page.waitForTimeout(2000);
                            break;
                        }
                    } catch (e) {
                        continue;
                    }
                }
                
                await this.log(`대여 완료: ${notification.title}`);
                await this.sendTelegramNotification(`✅ 대여 완료: ${notification.title}`);
                return true;
            } else {
                await this.log(`대여 버튼을 찾을 수 없음: ${notification.title}`);
                return false;
            }
        } catch (error) {
            await this.log(`알림 처리 실패: ${notification.title} - ${error.message}`);
            return false;
        }
    }

    async run() {
        let successCount = 0;
        let failCount = 0;

        try {
            await this.init();
            
            if (await this.login()) {
                const notifications = await this.checkNotifications();
                
                if (notifications.length === 0) {
                    await this.log('처리할 새 알림이 없습니다.');
                    await this.sendTelegramNotification('ℹ️ 처리할 새 알림이 없습니다.');
                } else {
                    for (const notification of notifications) {
                        const success = await this.processNotification(notification);
                        if (success) {
                            successCount++;
                        } else {
                            failCount++;
                        }
                        
                        // 요청 간 딜레이
                        await this.page.waitForTimeout(3000);
                    }
                    
                    const summary = `📊 처리 완료\n성공: ${successCount}개\n실패: ${failCount}개`;
                    await this.log(summary);
                    await this.sendTelegramNotification(summary);
                }
            } else {
                await this.sendTelegramNotification('❌ 로그인 실패');
            }
        } catch (error) {
            await this.log(`실행 오류: ${error.message}`);
            await this.sendTelegramNotification(`❌ 실행 오류: ${error.message}`);
        } finally {
            if (this.browser) {
                await this.browser.close();
            }
        }
    }
}

// 실행
async function main() {
    const autoRental = new RidiBooksAutoRental();
    await autoRental.run();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = RidiBooksAutoRental;
