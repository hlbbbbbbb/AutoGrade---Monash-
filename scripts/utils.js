/**
 * 计算总加权成绩
 * @param {Array} assignments - 所有作业数据，每个包含score, total, weight
 * @returns {Object} 包含总成绩、百分比等信息
 */
function calculateTotalGrade(assignments) {
  // 初始化计算变量
  let totalWeightedScore = 0;
  let totalWeight = 0;
  let completedWeight = 0;
  let assignmentsWithWeight = 0;
  
  // 遍历每个作业计算加权分数
  assignments.forEach(assignment => {
    if (assignment.weight > 0) {
      assignmentsWithWeight++;
      
      // 只有有分数的作业才计入总成绩
      if (assignment.score !== null && assignment.score !== undefined) {
        const weightedScore = (assignment.score / assignment.total) * assignment.weight;
        totalWeightedScore += weightedScore;
        completedWeight += assignment.weight;
      }
      
      totalWeight += assignment.weight;
    }
  });
  
  // 计算总成绩百分比
  const currentPercentage = totalWeightedScore * 100;
  
  // 检查总权重是否接近1，如果不是，可能缺少权重信息
  const weightSumWarning = Math.abs(totalWeight - 1.0) > 0.01;
  
  // 计算缺失成绩的权重百分比
  const missingWeight = totalWeight - completedWeight;
  
  // 计算不同等级所需的额外分数
  // 假设P是50%, C是60%, D是70%, HD是80%
  let toPass = null;
  let toCredit = null;
  let toDistinction = null;
  let toHighDistinction = null;
  
  if (missingWeight > 0) {
    // 计算达到各等级还需要的平均分
    toPass = calculateRequiredScore(currentPercentage, missingWeight, 50);
    toCredit = calculateRequiredScore(currentPercentage, missingWeight, 60);
    toDistinction = calculateRequiredScore(currentPercentage, missingWeight, 70);
    toHighDistinction = calculateRequiredScore(currentPercentage, missingWeight, 80);
  }
  
  return {
    currentPercentage,
    completedWeight,
    totalWeight,
    missingWeight,
    weightSumWarning,
    requirementEstimates: {
      toPass,
      toCredit,
      toDistinction,
      toHighDistinction
    }
  };
}

/**
 * 计算达到目标成绩所需的分数
 * @param {number} currentPercentage - 当前加权成绩百分比
 * @param {number} remainingWeight - 剩余权重
 * @param {number} targetPercentage - 目标最终百分比
 * @returns {number|null} 剩余部分需要的平均得分率(0-100)，如果不可能则返回null
 */
function calculateRequiredScore(currentPercentage, remainingWeight, targetPercentage) {
  if (remainingWeight <= 0) return null;
  
  // 计算剩余部分需要的分数贡献
  const requiredContribution = targetPercentage - currentPercentage;
  
  // 检查是否已经达到目标
  if (requiredContribution <= 0) return 0;
  
  // 计算剩余部分平均需要的得分率
  const requiredAverageScore = requiredContribution / remainingWeight;
  
  // 检查是否可能达到目标(不超过100%)
  if (requiredAverageScore > 100) return null;
  
  return Math.round(requiredAverageScore * 10) / 10; // 保留一位小数
}

/**
 * 格式化成绩显示
 * @param {number} percentage - 百分比值
 * @returns {string} 格式化的百分比字符串，如"85.5%"
 */
function formatPercentage(percentage) {
  if (percentage === null || percentage === undefined) return "未知";
  return percentage.toFixed(1) + "%";
}

/**
 * 根据百分比获取成绩等级
 * @param {number} percentage - 百分比成绩
 * @returns {string} 成绩等级(HD, D, C, P或F)
 */
function getGradeLevel(percentage) {
  if (percentage >= 80) return "HD";
  if (percentage >= 70) return "D";
  if (percentage >= 60) return "C";
  if (percentage >= 50) return "P";
  return "F";
}

// 导出所有工具函数，使其可在其他脚本中使用
window.gradeUtils = {
  calculateTotalGrade,
  calculateRequiredScore,
  formatPercentage,
  getGradeLevel
}; 