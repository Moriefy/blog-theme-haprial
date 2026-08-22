// 博客管理后台API测试脚本
// 使用方法: node test_api.js

const API_BASE = 'https://your-worker-domain.workers.dev'; // 替换为你的Worker域名

// 测试函数
async function testAPI(method, path, data = null) {
    try {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer test-token' // 需要替换为有效的管理token
            }
        };
        if (data) {
            options.body = JSON.stringify(data);
        }
        
        const response = await fetch(`${API_BASE}${path}`, options);
        const result = await response.json();
        
        console.log(`✅ ${method} ${path}:`, response.status);
        if (result.error) {
            console.log(`   ❌ 错误: ${result.error}`);
        } else {
            console.log(`   ✅ 成功`);
        }
        return result;
    } catch (error) {
        console.log(`❌ ${method} ${path}:`, error.message);
        return null;
    }
}

// 测试所有新API
async function runTests() {
    console.log('开始测试博客管理后台API...\n');
    
    // 1. 数据分析与统计
    console.log('=== 1. 数据分析与统计 ===');
    await testAPI('GET', '/api/admin/analytics');
    await testAPI('POST', '/api/admin/analytics/record', { page_slug: 'test-page' });
    
    // 2. SEO优化工具
    console.log('\n=== 2. SEO优化工具 ===');
    await testAPI('GET', '/api/admin/seo');
    await testAPI('PUT', '/api/admin/seo/test-page', {
        meta_title: 'Test Page',
        meta_description: 'This is a test page',
        robots: 'index, follow'
    });
    await testAPI('DELETE', '/api/admin/seo/test-page');
    
    // 3. 性能监控
    console.log('\n=== 3. 性能监控 ===');
    await testAPI('POST', '/api/admin/performance/record', {
        metric: 'page_load_time',
        value: 1200,
        page_slug: 'home'
    });
    await testAPI('GET', '/api/admin/performance');
    await testAPI('GET', '/api/admin/performance/recent');
    
    // 4. 内容管理增强
    console.log('\n=== 4. 内容管理增强 ===');
    // 需要先有文章ID，这里假设文章ID为1
    await testAPI('GET', '/api/admin/articles/1/versions');
    await testAPI('POST', '/api/admin/articles/1/versions', {
        title: 'Test Version',
        content: 'Test content'
    });
    
    // 5. 自动化与备份
    console.log('\n=== 5. 自动化与备份 ===');
    await testAPI('POST', '/api/admin/backups', { type: 'manual' });
    await testAPI('GET', '/api/admin/backups');
    
    // 6. 外观与主题自定义
    console.log('\n=== 6. 外观与主题自定义 ===');
    await testAPI('GET', '/api/admin/theme');
    await testAPI('PUT', '/api/admin/theme', {
        key: 'primary_color',
        value: '#1976d2'
    });
    await testAPI('POST', '/api/admin/theme/reset');
    
    // 7. 集成与扩展
    console.log('\n=== 7. 集成与扩展 ===');
    await testAPI('GET', '/api/admin/integrations');
    await testAPI('PUT', '/api/admin/integrations/test-service', {
        config: JSON.stringify({ api_key: 'test-key' }),
        enabled: 1
    });
    await testAPI('DELETE', '/api/admin/integrations/test-service');
    
    // 8. 移动端优化
    console.log('\n=== 8. 移动端优化 ===');
    await testAPI('GET', '/api/admin/push/subscribers');
    
    console.log('\n测试完成！');
}

// 运行测试
runTests().catch(console.error);