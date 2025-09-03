// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);

// 初始化函数
function init() {
  // 获取DOM元素
  const statusMessage = document.getElementById('status-message');
  const gradeSummary = document.getElementById('grade-summary');
  const assignmentsContainer = document.getElementById('assignments-container');
  const predictionsContainer = document.getElementById('predictions-container');
  const errorMessage = document.getElementById('error-message');
  const refreshButton = document.getElementById('refresh-button');
  
  // 绑定刷新按钮事件
  refreshButton.addEventListener('click', fetchGradeData);
  
  // 初始化时获取数据
  fetchGradeData();
  
  // 获取成绩数据
  function fetchGradeData() {
    statusMessage.textContent = '正在获取成绩数据...';
    errorMessage.textContent = '';
    errorMessage.classList.add('hidden');
    
    // 隐藏结果容器
    gradeSummary.classList.add('hidden');
    assignmentsContainer.classList.add('hidden');
    predictionsContainer.classList.add('hidden');
    
    // 向当前活动标签页的content script发送消息
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs || !tabs[0] || !tabs[0].url) {
        showError('请打开Monash成绩页面再使用此插件');
        return;
      }
      
      const currentUrl = tabs[0].url || '';
      
      if (!currentUrl.includes('learning.monash.edu')) {
        // 不在Monash页面
        showError('请在Monash学习系统中使用此插件');
        return;
      }
      
      if (!currentUrl.includes('/grade/report/')) {
        // 不在成绩页面
        showError('请导航到成绩报告页面 (grade/report)');
        return;
      }
      
      // 发送消息获取数据
      chrome.tabs.sendMessage(tabs[0].id, {action: 'getGradeData'}, function(response) {
        if (chrome.runtime.lastError) {
          showError('无法连接到页面，请刷新后重试 (错误: ' + chrome.runtime.lastError.message + ')');
          return;
        }
        
        if (!response) {
          showError('未收到页面响应，请刷新后重试');
          return;
        }
        
        if (!response.data || response.data.length === 0) {
          showError('在页面上未找到任何成绩数据，请确保已登录并位于成绩页面');
          return;
        }
        
        // 处理响应数据
        processGradeData(response.data);
      });
    });
  }
  
  // 处理成绩数据
  function processGradeData(assignments) {
    if (!assignments || assignments.length === 0) {
      showError('未找到任何作业数据');
      return;
    }
    
    try {
      // 计算总成绩
      const result = window.gradeUtils.calculateTotalGrade(assignments);
      
      // 更新UI
      updateGradeSummary(result);
      updateAssignmentsList(assignments);
      updatePredictions(result);
      
      // 显示结果容器
      statusMessage.textContent = '成绩数据已更新';
      gradeSummary.classList.remove('hidden');
      
      if (assignments.length > 0) {
        assignmentsContainer.classList.remove('hidden');
      }
      
      if (result.missingWeight > 0) {
        predictionsContainer.classList.remove('hidden');
      }
    } catch (error) {
      console.error('处理成绩数据出错:', error);
      showError('处理成绩数据时出错: ' + error.message);
    }
  }
  
  // 更新成绩摘要
  function updateGradeSummary(result) {
    document.getElementById('current-percentage').textContent = 
      window.gradeUtils.formatPercentage(result.currentPercentage);
    
    document.getElementById('grade-level').textContent = 
      window.gradeUtils.getGradeLevel(result.currentPercentage);
    
    document.getElementById('completed-weight').textContent = 
      Math.round(result.completedWeight * 100) + '%';
    
    document.getElementById('total-weight').textContent = 
      Math.round(result.totalWeight * 100) + '%';
    
    // 更新权重进度条
    const weightPercentage = (result.completedWeight / result.totalWeight) * 100;
    document.getElementById('completed-weight-bar').style.width = weightPercentage + '%';
    
    // 如果权重总和不接近1，显示警告
    if (result.weightSumWarning) {
      showError('警告: 权重总和不为100%，计算可能不准确');
    }
  }
  
  // 更新作业列表
  function updateAssignmentsList(assignments) {
    const listElement = document.getElementById('assignments-list');
    listElement.innerHTML = '';
    
    assignments.forEach(assignment => {
      const item = document.createElement('div');
      item.className = 'assignment-item';
      
      const nameElement = document.createElement('div');
      nameElement.className = 'assignment-name';
      nameElement.textContent = assignment.name;
      
      const scoreElement = document.createElement('div');
      scoreElement.className = 'assignment-score';
      scoreElement.textContent = `${assignment.score}/${assignment.total}`;
      
      const weightElement = document.createElement('div');
      weightElement.className = 'assignment-weight';
      weightElement.textContent = `${Math.round(assignment.weight * 100)}%`;
      
      item.appendChild(nameElement);
      item.appendChild(scoreElement);
      item.appendChild(weightElement);
      
      listElement.appendChild(item);
    });
  }
  
  // 更新预测分析
  function updatePredictions(result) {
    const predictionTableBody = document.getElementById('prediction-table-body');
    predictionTableBody.innerHTML = '';
    
    const predictionMessage = document.getElementById('prediction-message');
    
    if (result.missingWeight <= 0) {
      predictionMessage.textContent = '所有成绩已完成，无需预测。';
      return;
    }
    
    const missingPercentage = Math.round(result.missingWeight * 100);
    predictionMessage.textContent = 
      `还有${missingPercentage}%的成绩未完成。要达到以下等级，你需要在剩余项目中获得:`;
    
    // 添加各等级所需分数
    addPredictionRow('HD (≥80%)', result.requirementEstimates.toHighDistinction);
    addPredictionRow('D (≥70%)', result.requirementEstimates.toDistinction);
    addPredictionRow('C (≥60%)', result.requirementEstimates.toCredit);
    addPredictionRow('P (≥50%)', result.requirementEstimates.toPass);
  }
  
  // 添加预测表格行
  function addPredictionRow(grade, requiredScore) {
    const predictionTableBody = document.getElementById('prediction-table-body');
    
    const row = document.createElement('tr');
    
    const gradeCell = document.createElement('td');
    gradeCell.textContent = grade;
    
    const scoreCell = document.createElement('td');
    if (requiredScore === null) {
      scoreCell.textContent = '不可能达到';
      scoreCell.style.color = '#d93025';
    } else if (requiredScore === 0) {
      scoreCell.textContent = '已达到';
      scoreCell.style.color = '#188038';
    } else {
      scoreCell.textContent = requiredScore + '%';
    }
    
    row.appendChild(gradeCell);
    row.appendChild(scoreCell);
    
    predictionTableBody.appendChild(row);
  }
  
  // 显示错误信息
  function showError(message) {
    statusMessage.textContent = '获取数据失败';
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
  }
} 