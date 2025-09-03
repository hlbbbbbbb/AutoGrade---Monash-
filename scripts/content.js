// 监听页面加载完成
document.addEventListener('DOMContentLoaded', function() {
  // 检查是否在Moodle成绩页面
  if (isMoodleGradePage()) {
    console.log('在Moodle成绩页面，开始抓取数据...');
    extractGradeData();
  }
});

// 监听消息，可能页面已经加载完成时插件才被激活
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "pageLoaded") {
    // 再次检查是否在成绩页面
    if (isMoodleGradePage()) {
      console.log('通过消息触发：在Moodle成绩页面，开始抓取数据...');
      extractGradeData();
    }
  }
  
  if (request.action === "getGradeData") {
    // 重新获取最新数据
    if (isMoodleGradePage()) {
      extractGradeData();
    }
    
    // 从存储中读取数据并响应
    chrome.storage.local.get(['gradeData'], function(result) {
      sendResponse({data: result.gradeData || []});
    });
    return true; // 表示将异步发送响应
  }
});

// 检查是否在Moodle成绩页面
function isMoodleGradePage() {
  // 检查URL是否包含grade/report部分
  return window.location.href.includes('/grade/report/user/index.php');
}

// 提取成绩数据
function extractGradeData() {
  // 存储所有课程作业数据
  const assignments = [];
  
  try {
    console.log('开始提取成绩数据...');
    
    // 寻找所有带ASSIGNMENT标记的行
    const assignmentRows = document.querySelectorAll('tr:has(.cell.c0:has(.icon)):not(:has(.level1))');
    console.log('找到作业行数量:', assignmentRows ? assignmentRows.length : 0);
    
    // 如果上面的选择器不起作用，尝试一个更通用的选择器
    if (!assignmentRows || assignmentRows.length === 0) {
      // 查找所有包含作业的行 - 通过查找带有成绩的行
      const allRows = document.querySelectorAll('tr');
      console.log('页面上找到表格行总数:', allRows.length);
      
      // 遍历所有行，查找有成绩数据的行
      allRows.forEach((row, index) => {
        // 查看是否包含ASSIGNMENT文本
        const rowText = row.textContent || '';
        if (rowText.includes('ASSIGNMENT') || rowText.includes('Assignment')) {
          processAssignmentRow(row, assignments);
        }
      });
    } else {
      // 使用找到的作业行
      assignmentRows.forEach(row => {
        processAssignmentRow(row, assignments);
      });
    }
    
    // 如果仍未找到作业，尝试直接解析页面上所有可能的作业行
    if (assignments.length === 0) {
      console.log('尝试通用方法提取成绩...');
      const tableRows = document.querySelectorAll('table tr');
      
      tableRows.forEach(row => {
        // 检查行中是否有分数格式
        const rowText = row.textContent || '';
        // 查找类似 "81.61" 或 "72.13" 的分数模式，以及百分比如 "(25%)" 或 "(17%)"
        if (/\d+\.\d+/.test(rowText) && /\(\d+%\)/.test(rowText)) {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 2) {
            // 尝试提取作业信息
            let name = '';
            let score = null;
            let total = 100; // 默认满分100
            let weight = 0;
            
            // 尝试从第一个单元格获取名称和权重
            const firstCellText = cells[0].textContent.trim();
            name = firstCellText.split('(')[0].trim();
            
            // 尝试提取权重
            const weightMatch = firstCellText.match(/\((\d+)%\)/);
            if (weightMatch) {
              weight = parseFloat(weightMatch[1]) / 100;
            }
            
            // 从其他单元格中寻找分数
            for (let i = 1; i < cells.length; i++) {
              const cellText = cells[i].textContent.trim();
              const scoreMatch = cellText.match(/(\d+\.\d+)/);
              if (scoreMatch) {
                score = parseFloat(scoreMatch[1]);
                break;
              }
            }
            
            if (name && score !== null) {
              assignments.push({
                name,
                score,
                total,
                weight,
                percentage: (score / total) * 100
              });
              console.log('通用方法添加作业:', name, '得分:', score, '/', total, '权重:', weight);
            }
          }
        }
      });
    }
    
    console.log('提取的成绩数据:', assignments);
    
    if (assignments.length === 0) {
      // 如果仍然没找到作业，记录页面结构以便调试
      console.error('未能找到任何有效的作业数据');
      logPageStructure();
      return;
    }
    
    // 将数据发送给popup或存储
    chrome.storage.local.set({gradeData: assignments}, function() {
      console.log('成绩数据已保存, 数量:', assignments.length);
    });
    
  } catch (error) {
    console.error('提取成绩数据时出错:', error);
    logPageStructure();
  }
}

// 处理作业行
function processAssignmentRow(row, assignments) {
  try {
    // 提取作业名称和权重
    const nameCell = row.querySelector('.cell.c1') || row.cells[1];
    if (!nameCell) {
      console.log('行中未找到名称单元格:', row.innerHTML.substring(0, 100));
      return;
    }
    
    // 获取作业名称文本
    let name = nameCell.textContent.trim();
    let weight = 0;
    
    // 尝试从名称中提取权重，如 "Assignment 1 - Instructions (25%)"
    const weightMatch = name.match(/\((\d+)%\)/);
    if (weightMatch) {
      weight = parseFloat(weightMatch[1]) / 100;
    }
    
    // 提取分数
    // 首先查找显示分数的单元格
    const scoreCell = row.querySelector('.column-grade') || 
                       row.querySelector('.c2') || 
                       row.cells[2]; // 假设第三列是分数
    
    if (!scoreCell) {
      console.log('未找到分数单元格:', name);
      return;
    }
    
    const scoreText = scoreCell.textContent.trim();
    console.log('作业:', name, '分数文本:', scoreText);
    
    // 尝试提取分数，如 "81.61"
    const scoreMatch = scoreText.match(/(\d+\.?\d*)/);
    if (!scoreMatch) {
      console.log('无法解析分数:', scoreText);
      return;
    }
    
    const score = parseFloat(scoreMatch[1]);
    const total = 100; // 默认满分为100
    
    // 添加作业数据
    assignments.push({
      name,
      score,
      total,
      weight,
      percentage: (score / total) * 100
    });
    
    console.log('添加作业:', name, '得分:', score, '/', total, '权重:', weight);
  } catch (error) {
    console.error('处理作业行时出错:', error);
  }
}

// 记录页面结构以便调试
function logPageStructure() {
  console.log('记录页面结构以便调试...');
  
  // 记录所有表格
  const tables = document.querySelectorAll('table');
  console.log('找到表格数量:', tables.length);
  
  // 记录第一个表格的结构
  if (tables.length > 0) {
    const firstTable = tables[0];
    console.log('第一个表格类名:', firstTable.className);
    console.log('第一个表格行数:', firstTable.rows.length);
    
    // 记录前几行的结构
    for (let i = 0; i < Math.min(5, firstTable.rows.length); i++) {
      const row = firstTable.rows[i];
      console.log(`行 ${i} 类名:`, row.className);
      console.log(`行 ${i} 单元格数:`, row.cells.length);
      console.log(`行 ${i} 文本:`, row.textContent.substring(0, 100));
    }
  }
  
  // 尝试记录页面上所有作业相关元素
  const assignmentElements = document.querySelectorAll('[class*="assign"], [id*="assign"]');
  console.log('找到作业相关元素:', assignmentElements.length);
  
  // 记录页面HTML片段用于调试
  console.log('页面HTML片段:', document.body.innerHTML.substring(0, 5000));
} 