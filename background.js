// 监听插件安装或更新事件
chrome.runtime.onInstalled.addListener(function(details) {
  if (details.reason === 'install') {
    // 首次安装逻辑
    console.log('AutoGrade插件已安装');
  } else if (details.reason === 'update') {
    // 更新逻辑
    console.log('AutoGrade插件已更新');
  }
});

// 监听标签页URL变化，检测是否在Moodle成绩页面
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('learning.monash.edu')) {
    // 向content script发送页面加载完成的消息
    chrome.tabs.sendMessage(tabId, {
      action: "pageLoaded",
      url: tab.url
    }).catch(error => {
      // 忽略因content script未加载而产生的错误
      console.log('Content script可能尚未准备好接收消息');
    });
  }
});

// 监听来自popup或content script的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "getActiveTab") {
    // 获取当前活动标签页信息
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      sendResponse({tab: tabs[0]});
    });
    return true; // 表示将异步发送响应
  }
}); 