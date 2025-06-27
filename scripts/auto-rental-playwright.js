const { chromium } = require('playwright');
const fs = require('fs').promises;

async function debugLoginPage() {
    console.log('리디북스 로그인 페이지 분석 시작...');
    
    const browser = await chromium.launch({
  headless: true, // Add this line
  // ... other options
});
    const page = await browser.newPage();
    
    try {
        // 리디북스 로그인 페이지로 이동
        await page.goto('https://ridibooks.com/account/login', {
            waitUntil: 'networkidle',
            timeout: 30000
        });
        
        console.log('페이지 로딩 완료');
        
        // 페이지 스크린샷 저장
        await page.screenshot({ path: 'login-page.png', fullPage: true });
        console.log('스크린샷 저장: login-page.png');
        
        // 현재 URL 확인
        console.log('현재 URL:', page.url());
        
        // 페이지 제목 확인
        const title = await page.title();
        console.log('페이지 제목:', title);
        
        // HTML 구조 분석
        const pageInfo = await page.evaluate(() => {
            const inputs = Array.from(document.querySelectorAll('input')).map(input => ({
                type: input.type,
                name: input.name,
                id: input.id,
                placeholder: input.placeholder,
                className: input.className,
                outerHTML: input.outerHTML.substring(0, 200)
            }));
            
            const buttons = Array.from(document.querySelectorAll('button')).map(button => ({
                type: button.type,
                textContent: button.textContent.trim(),
                className: button.className,
                outerHTML: button.outerHTML.substring(0, 200)
            }));
            
            const forms = Array.from(document.querySelectorAll('form')).map(form => ({
                action: form.action,
                method: form.method,
                className: form.className,
                outerHTML: form.outerHTML.substring(0, 300)
            }));
            
            return {
                inputs,
                buttons,
                forms,
                bodyHTML: document.body.innerHTML.substring(0, 1000)
            };
        });
        
        // 결과를 파일로 저장
        await fs.writeFile('login-page-analysis.json', JSON.stringify(pageInfo, null, 2));
        console.log('페이지 분석 결과 저장: login-page-analysis.json');
        
        // 콘솔에 주요 정보 출력
        console.log('\n=== 입력 필드들 ===');
        pageInfo.inputs.forEach((input, i) => {
            console.log(`${i + 1}. Type: ${input.type}, Name: ${input.name}, ID: ${input.id}, Placeholder: ${input.placeholder}`);
        });
        
        console.log('\n=== 버튼들 ===');
        pageInfo.buttons.forEach((button, i) => {
            console.log(`${i + 1}. Type: ${button.type}, Text: ${button.textContent}, Class: ${button.className}`);
        });
        
        console.log('\n=== 폼들 ===');
        pageInfo.forms.forEach((form, i) => {
            console.log(`${i + 1}. Action: ${form.action}, Method: ${form.method}, Class: ${form.className}`);
        });
        
        // 5초 대기 (수동으로 페이지 확인 가능)
        console.log('\n5초 후 브라우저를 닫습니다...');
        await page.waitForTimeout(5000);
        
    } catch (error) {
        console.error('오류 발생:', error);
    } finally {
        await browser.close();
    }
}

// 실행
debugLoginPage().catch(console.error);
