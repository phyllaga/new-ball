import React, { useState, useEffect, useRef } from 'react';
import contractsData from './ContractsData.json';
import {
  calculateAccountInfo,
  translateDirection,
  translateMarginType,
  mergePositionsBySymbol,
  isPositionClosed
} from './CalculationUtils';
import { createNewPosition, closePosition, recalculateAllPositions } from './PositionHandlers';
import { logBalanceHistory, logCalculation, logAccountMetrics, logMergedPositionCalculation } from './LoggingUtils';

/**
 * 合约计算器主组件
 */
export default function ContractFormulaCalculator() {
  // 基本参数状态
  const [symbol, setSymbol] = useState('btc_usdt');
  const [currentPrice, setCurrentPrice] = useState(20000);
  const [maintenanceMarginRate, setMaintenanceMarginRate] = useState(0.005);
  const [contractValue, setContractValue] = useState(0.0001);
  const [initialBalance, setInitialBalance] = useState(1000);
  const [currentBalance, setCurrentBalance] = useState(1000);
  const [feeRate, setFeeRate] = useState(0.0004);

  // 仓位相关状态
  const [entryPrice, setEntryPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [direction, setDirection] = useState('long');
  const [leverage, setLeverage] = useState(10);
  const [marginType, setMarginType] = useState('cross');
  const [positions, setPositions] = useState([]);
  const [logs, setLogs] = useState([]);

  // 自动刷新相关状态
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [contractList, setContractList] = useState([]);
  const [marketData, setMarketData] = useState([]);
  const [selectedContract, setSelectedContract] = useState(null);

  // 自动刷新定时器引用
  const refreshTimerRef = useRef(null);
// 处理打赏功能
  const handleDonation = async () => {
    const donationAddress = '0xe67b62825fee3322a68e9e7e10d0e9223fabc39c';

    // 检查是否有 MetaMask
    if (typeof window.ethereum === 'undefined') {
      alert('请安装 MetaMask 钱包以便进行打赏');
      return;
    }

    try {
      // 获取当前账户
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const account = accounts[0];

      // 弹出输入框让用户输入打赏金额
      const amountETH = prompt('请输入打赏金额 (ETH)', '0.01');
      if (!amountETH || isNaN(parseFloat(amountETH)) || parseFloat(amountETH) <= 0) {
        addToLog(`打赏取消或金额无效`);
        return;
      }

      // 将 ETH 转换为 Wei (1 ETH = 10^18 Wei)
      // 确保生成有效的十六进制值，且不带小数点
      const amountWei = `0x${Math.floor(parseFloat(amountETH) * 1e18).toString(16)}`;

      addToLog(`--- 发起打赏交易 ---`);
      addToLog(`打赏地址: ${donationAddress}`);
      addToLog(`打赏金额: ${amountETH} ETH (${amountWei} Wei)`);

      // 请求 MetaMask 发送交易
      const transactionParameters = {
        to: donationAddress,
        from: account,
        value: amountWei,
        // 添加 gas 参数，让 MetaMask 自动估算
        gas: '',
        // 添加可选的 chainId
        chainId: window.ethereum.chainId || '0x1' // 默认为以太坊主网
      };

      // 发送交易请求
      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [transactionParameters],
      });

      addToLog(`交易发送成功! 交易哈希: ${txHash}`);
      addToLog(`感谢您的支持! ❤️`);

    } catch (error) {
      console.error('打赏交易错误:', error);
      addToLog(`打赏失败: ${error.message || '未知错误'}`);

      // 更详细的错误信息记录，帮助调试
      if (error.code) {
        addToLog(`错误代码: ${error.code}`);
      }
    }
  };

  // 当前日期和时间，用户名
  const currentDateTime = "2025-05-16 07:44:03";
  const currentUser = "z";

  // 添加日志
  const addToLog = (message) => {
    setLogs(prev => [...prev, message]);
  };

  // 初始化合约列表
  useEffect(() => {
    setContractList(contractsData);
    fetchMarketData();
  }, []);

  // 自动刷新价格定时器
  useEffect(() => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    if (autoRefresh) {
      addToLog(`--- 已开启自动刷新价格 (每秒) ---`);
      refreshTimerRef.current = setInterval(() => {
        fetchMarketData(true);
      }, 1000);
    } else if (refreshTimerRef.current) {
      addToLog(`--- 已关闭自动刷新价格 ---`);
    }

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [autoRefresh]);

  // 参数变化时重新计算
  useEffect(() => {
    recalculatePositions();
  }, [currentPrice, maintenanceMarginRate, feeRate]);

  // 初始余额更改时，保持当前余额与初始余额一致（仅用于初始设置）
  useEffect(() => {
    if (positions.length === 0) {
      setCurrentBalance(initialBalance);
    }
  }, [initialBalance]);

  // 获取行情数据
  const fetchMarketData = async (isAutoRefresh = false) => {
    if (!isAutoRefresh) {
      setIsLoading(true);
      addToLog(`--- 正在获取行情数据 ---`);
    }

    try {
      const response = await fetch('https://mgbx.com/futures/fapi/market/v1/public/m/allticker');
      const data = await response.json();

      if (data && data.data && Array.isArray(data.data)) {
        setMarketData(data.data);

        const now = new Date();
        const timeString = now.toLocaleTimeString();
        setLastUpdated(timeString);

        if (!isAutoRefresh) {
          addToLog(`成功获取 ${data.data.length} 个交易对行情数据`);
        }

        if (selectedContract) {
          updatePriceForSelectedContract(selectedContract.symbol, data.data, isAutoRefresh);
        }
      }
    } catch (error) {
      if (!isAutoRefresh) {
        addToLog(`获取行情数据失败: ${error.message}`);
      }
    }

    if (!isAutoRefresh) {
      setIsLoading(false);
    }
  };

  // 更新所选合约的价格和合约面值
  const updatePriceForSelectedContract = (symbolCode, marketDataArray, isAutoRefresh = false) => {
    const matchingMarket = marketDataArray.find(item => item.symbol === symbolCode);

    if (matchingMarket) {
      const price = parseFloat(matchingMarket.last);
      setCurrentPrice(price);

      if (!isAutoRefresh) {
        const contract = contractList.find(c => c.symbol === symbolCode);
        if (contract) {
          const contractSizeValue = parseFloat(contract.contractSize);
          setContractValue(contractSizeValue);
          setSelectedContract(contract);
          setLeverage(contract.initLeverage);

          addToLog(`更新交易对 ${symbolCode} 信息:`);
          addToLog(`最新价格: ${price}`);
          addToLog(`面值(contractSize): ${contractSizeValue}`);
          addToLog(`初始杠杆: ${contract.initLeverage}x`);
        }
      }

      if (positions.length > 0) {
        recalculatePositions(isAutoRefresh);
      }
    }
  };

  // 处理合约选择
  const handleContractChange = (e) => {
    const selectedSymbol = e.target.value;
    if (!selectedSymbol) return;

    setSymbol(selectedSymbol);
    updatePriceForSelectedContract(selectedSymbol, marketData);
  };

  // 处理自动刷新开关
  const toggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh);
  };

  // 重新计算所有仓位
  const recalculatePositions = (isAutoRefresh = false) => {
    const updatedPositions = recalculateAllPositions({
      positions,
      currentPrice,
      contractValue,
      feeRate,
      maintenanceMarginRate,
      currentBalance,
      addToLog,
      currentUser,
      currentDateTime,
      isAutoRefresh
    });

    setPositions(updatedPositions);
  };

  // 创建仓位
  const createPosition = () => {
    if (!entryPrice || !quantity) return;

    const newPos = createNewPosition({
      symbol,
      direction,
      entryPrice,
      quantity,
      currentPrice,
      leverage,
      marginType,
      contractValue,
      feeRate,
      maintenanceMarginRate,
      addToLog,
      dex:0,
      currentDateTime,
      currentUser
    });

    // 获取包括新仓位在内的所有仓位
    const allPositions = [...positions, newPos];

    // 计算所有仓位的DEX和爆仓价
    const finalPositions = recalculateAllPositions({
      positions: allPositions,
      currentPrice,
      contractValue,
      feeRate,
      maintenanceMarginRate,
      currentBalance,
      addToLog,
      currentUser,
      currentDateTime
    });

    setPositions(finalPositions);
    addToLog(`仓位创建成功: ${symbol} ${translateDirection(direction)} ${quantity}张 @${entryPrice}，当前余额保持为 ${currentBalance?.toFixed(4)}`);

    // 清空输入框
    setEntryPrice('');
    setQuantity('');
  };

  // 平仓操作
  const handleClosePosition = (index) => {
    const closePrice = parseFloat(prompt('请输入平仓价格', currentPrice));
    if (isNaN(closePrice)) return;

    // 使用更新的closePosition函数，它会立即重新计算所有仓位
    const result = closePosition({
      position: positions[index],
      index,
      closePrice,
      positions,
      currentBalance,
      contractValue,
      feeRate,
      maintenanceMarginRate,
      addToLog,
      currentUser,
      currentDateTime
    });

    // 使用函数返回的结果更新状态
    setCurrentBalance(result.newBalance);
    setPositions(result.updatedPositions);

    // 不需要额外调用recalculatePositions，因为closePosition已经完成了重新计算
    addToLog(`平仓完成，所有仓位的DEX和爆仓价已更新`);
  };

  // 删除仓位
  const deletePosition = (index) => {
    const posToDelete = positions[index];
    addToLog(`--- 删除仓位 ---`);
    addToLog(`用户: ${currentUser}`);
    addToLog(`时间: ${currentDateTime} (UTC)`);
    addToLog(`仓位已删除: ${posToDelete.symbol} ${translateDirection(posToDelete.direction)} ${posToDelete.quantity}张 @${posToDelete.entryPrice}`);

    const newPositions = positions.filter((_, i) => i !== index);
    setPositions(newPositions);

    // 删除仓位后需要重新计算所有仓位的DEX和爆仓价
    addToLog(`--- 删除后重新计算所有仓位 ---`);
    setTimeout(() => {
      if (newPositions.filter(p => !isPositionClosed(p)).length > 0) {
        recalculatePositions();
      }
    }, 100);
  };

  // 重置余额为初始余额
  const resetBalance = () => {
    setCurrentBalance(initialBalance);
    addToLog(`余额已重置为初始值: ${initialBalance.toFixed(4)}`);
  };

  // 清空日志
  const clearLogs = () => setLogs([]);

  // 手动刷新价格
  const refreshPrice = async () => {
    addToLog(`--- 手动刷新行情价格 ---`);
    try {
      await fetchMarketData();
      addToLog(`行情价格刷新成功`);
    } catch (error) {
      addToLog(`行情价格刷新失败: ${error.message}`);
    }
  };

  // 处理余额历史记录
  const handleLogBalanceHistory = () => {
    addToLog(`--- 查看余额变更历史 (${currentDateTime}) ---`);
    addToLog(`用户: ${currentUser}`);

    // 查找所有已平仓的仓位
    const closedPositions = positions.filter(p => isPositionClosed(p));

    if (closedPositions.length > 0) {
      let runningBalance = initialBalance;

      addToLog(`初始余额: ${initialBalance.toFixed(4)}`);

      closedPositions.forEach((pos, index) => {
        const posRealizedPnl = parseFloat(pos.realizedPnl);
        const posOpenFee = parseFloat(pos.openFee);
        const posCloseFee = parseFloat(pos.closeFee);


        // 详细展示这笔交易对余额的影响
        addToLog(`\n[${index + 1}] ${pos.symbol} ${translateDirection(pos.direction)} ${pos.quantity}张`);
        addToLog(`  开仓价: ${pos.entryPrice} → 平仓价: ${pos.closePrice}`);
        addToLog(`  已实现盈亏: ${posRealizedPnl >= 0 ? '+' : ''}${posRealizedPnl?.toFixed(4)}`);
        addToLog(`  开仓手续费: -${posOpenFee?.toFixed(4)}`);
        addToLog(`  平仓手续费: -${posCloseFee?.toFixed(4)}`);

        // 计算影响
        const totalFees = posOpenFee + posCloseFee;
        const netImpact = posRealizedPnl - totalFees;

        addToLog(`  --- 余额计算过程 ---`);
        addToLog(`  交易前余额: ${runningBalance.toFixed(4)}`);
        addToLog(`  计算公式: 交易前余额 + 已实现盈亏 - 总手续费`);
        addToLog(`  计算过程: ${runningBalance.toFixed(4)} + ${posRealizedPnl.toFixed(4)} - ${totalFees.toFixed(4)}`);

        // 更新运行中的余额
        runningBalance = runningBalance + netImpact;

        addToLog(`  = ${runningBalance.toFixed(4)}`);
        addToLog(`  交易后余额: ${runningBalance.toFixed(4)}`);
      });

      // 确认最终余额
      if (Math.abs(runningBalance - currentBalance) < 0.0001) {
        addToLog(`\n最终余额: ${currentBalance.toFixed(4)} (计算正确)`);
      } else {
        addToLog(`\n最终余额: ${currentBalance.toFixed(4)}`);
        addToLog(`计算所得余额: ${runningBalance.toFixed(4)}`);
        addToLog(`注意: 最终余额与计算所得余额有差异，可能存在其他因素影响`);
      }
    } else {
      addToLog(`尚无平仓记录，当前余额与初始余额相同: ${currentBalance.toFixed(4)}`);
    }
  };

  // 修改 handleLogCalculation 函数
  // 修改 handleLogCalculation 函数
  const handleLogCalculation = (type, pos) => {
    // 如果是DEX或爆仓价计算，且是全仓仓位，先检查是否需要合并计算
    if ((type === 'dex' || type === 'liq') && pos.marginType === 'cross') {
      // 获取相同交易对的全仓仓位
      const sameCrossPositions = positions.filter(
          p => p.marginType === 'cross' && p.symbol === pos.symbol && !isPositionClosed(p)
      );

      // 如果有多个相同交易对的全仓仓位，先显示合并计算
      if (sameCrossPositions.length > 1) {
        addToLog(`--- ${pos.symbol} 全仓仓位合并计算 ---`);
        logMergedPositionCalculation(sameCrossPositions, addToLog, contractValue);

        // 如果是爆仓价计算，显示合并后的爆仓价计算
        if (type === 'liq') {
          // 获取合并后的仓位信息
          const { mergedPositions } = mergePositionsBySymbol(sameCrossPositions, contractValue);
          const mergedPos = mergedPositions.find(p => p.isMerged && p.symbol === pos.symbol);

          if (mergedPos) {
            addToLog(`\n--- 使用合并后的仓位计算爆仓价 ---`);
            const positionValue = Math.abs(parseFloat(mergedPos.quantity) * contractValue * parseFloat(mergedPos.entryPrice));
            const dex = parseFloat(mergedPos.dex || pos.dex);

            // 根据合并后的方向使用正确的计算公式
            if (mergedPos.direction === 'long') {
              const liquidationPrice = (positionValue - dex) / (parseFloat(mergedPos.quantity) * contractValue);
              addToLog(`多仓爆仓价计算公式：(仓位价值 - DEX) ÷ (持仓张数 × 合约面值)`);
              addToLog(`仓位价值计算：持仓张数 × 合约面值 × 开仓均价 = ${parseFloat(mergedPos.quantity)} × ${contractValue} × ${parseFloat(mergedPos.entryPrice)} = ${positionValue.toFixed(4)}`);
              addToLog(`计算过程：(${positionValue.toFixed(4)} - ${dex.toFixed(4)}) ÷ (${parseFloat(mergedPos.quantity)} × ${contractValue})`);
              addToLog(`= ${(positionValue - dex).toFixed(4)} ÷ ${(parseFloat(mergedPos.quantity) * contractValue).toFixed(4)}`);
              addToLog(`= ${liquidationPrice.toFixed(4)}`);
            } else {
              const liquidationPrice = (positionValue + dex) / (parseFloat(mergedPos.quantity) * contractValue);
              addToLog(`空仓爆仓价计算公式：(仓位价值 + DEX) ÷ (持仓张数 × 合约面值)`);
              addToLog(`仓位价值计算：持仓张数 × 合约面值 × 开仓均价 = ${parseFloat(mergedPos.quantity)} × ${contractValue} × ${Math.abs(parseFloat(mergedPos.entryPrice))} = ${positionValue.toFixed(4)}`);
              addToLog(`计算过程：(${positionValue.toFixed(4)} + ${dex.toFixed(4)}) ÷ (${parseFloat(mergedPos.quantity)} × ${contractValue})`);
              addToLog(`= ${(positionValue + dex).toFixed(4)} ÷ ${(parseFloat(mergedPos.quantity) * contractValue).toFixed(4)}`);
              addToLog(`= ${liquidationPrice.toFixed(4)}`);
            }
            return;
          }
        }
      }
    }

    // 特殊处理合并仓位的爆仓价计算
    if (type === 'liq' && pos.isMerged) {
      addToLog(`--- 合并仓位爆仓价计算 ---`);

      // 使用正确的合并仓位数据
      const positionValue = Math.abs(parseFloat(pos.quantity) * contractValue * parseFloat(pos.entryPrice));
      const dex = parseFloat(pos.dex);

      // 根据实际方向使用正确的计算公式
      if (pos.direction === 'long') {
        const liquidationPrice = (positionValue - dex) / (parseFloat(pos.quantity) * contractValue);
        addToLog(`多仓爆仓价计算公式：(仓位价值 - DEX) ÷ (持仓张数 × 合约面值)`);
        addToLog(`仓位价值计算：持仓张数 × 合约面值 × 开仓均价 = ${parseFloat(pos.quantity)} × ${contractValue} × ${parseFloat(pos.entryPrice)} = ${positionValue.toFixed(4)}`);
        addToLog(`计算过程：(${positionValue.toFixed(4)} - ${dex.toFixed(4)}) ÷ (${parseFloat(pos.quantity)} × ${contractValue})`);
        addToLog(`= ${(positionValue - dex).toFixed(4)} ÷ ${(parseFloat(pos.quantity) * contractValue).toFixed(4)}`);
        addToLog(`= ${liquidationPrice.toFixed(4)}`);
      } else {
        const liquidationPrice = (positionValue + dex) / (parseFloat(pos.quantity) * contractValue);
        addToLog(`空仓爆仓价计算公式：(仓位价值 + DEX) ÷ (持仓张数 × 合约面值)`);
        addToLog(`仓位价值计算：持仓张数 × 合约面值 × 开仓均价 = ${parseFloat(pos.quantity)} × ${contractValue} × ${Math.abs(parseFloat(pos.entryPrice))} = ${positionValue.toFixed(4)}`);
        addToLog(`计算过程：(${positionValue.toFixed(4)} + ${dex.toFixed(4)}) ÷ (${parseFloat(pos.quantity)} × ${contractValue})`);
        addToLog(`= ${(positionValue + dex).toFixed(4)} ÷ ${(parseFloat(pos.quantity) * contractValue).toFixed(4)}`);
        addToLog(`= ${liquidationPrice.toFixed(4)}`);
      }
      return;
    }

    // 常规计算日志
    logCalculation(
        type, pos, currentPrice, contractValue, feeRate,
        maintenanceMarginRate, positions, addToLog, currentUser, currentDateTime, currentBalance
    );
  };


  // 处理账户信息计算
  const handleAccountMetrics = () => {
    const accountInfo = calculateAccountInfo(positions, initialBalance, currentBalance);

    addToLog(`--- 账户指标计算 ---`);
    addToLog(`用户: ${currentUser}`);
    addToLog(`时间: ${currentDateTime} (UTC)`);

    const activePositions = positions.filter(p => !isPositionClosed(p));
    const closedPositions = positions.filter(p => isPositionClosed(p));

    addToLog(`初始余额: ${initialBalance.toFixed(4)}`);
    addToLog(`当前余额: ${currentBalance.toFixed(4)}`);

    // 全仓仓位合并计算
    const crossPositions = activePositions.filter(p => p.marginType === 'cross');
    const crossSymbols = [...new Set(crossPositions.map(p => p.symbol))];

    // 对每个有多个全仓仓位的交易对显示合并计算过程
    crossSymbols.forEach(symbol => {
      const positionsForSymbol = crossPositions.filter(p => p.symbol === symbol);
      if (positionsForSymbol.length > 1) {
        logMergedPositionCalculation(positionsForSymbol, addToLog,contractValue);
      }
    });

    // 显示账户信息详细计算
    addToLog(`全仓仓位数: ${activePositions.filter(p => p.marginType === 'cross').length}`);
    addToLog(`逐仓仓位数: ${activePositions.filter(p => p.marginType === 'isolated').length}`);

    // 如果有平仓记录，显示余额变更历史
    if (closedPositions.length > 0) {
      handleLogBalanceHistory();
    }
  };

  // 获取当前账户信息
  const accountInfo = calculateAccountInfo(positions, initialBalance, currentBalance);
  const {
    totalMarginCross,
    totalMarginIsolated,
    totalMargin,
    totalOpenFee,
    totalCloseFee,
    totalFee,
    totalUnrealizedPnl,
    totalRealizedPnl,
    availableBalance
  } = accountInfo;

  return (
      <div className="w-full min-w-full p-4 md:p-6">
        {/* 打赏按钮 */}
        <div className="flex justify-end mb-4">
          <button
              onClick={handleDonation}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-4 py-2 rounded-full shadow-md flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
            </svg>
            打赏开发者
          </button>
        </div>
        {/* 顶部基础参数设置区 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-8 gap-4 bg-gray-100 p-4 md:p-5 rounded-lg mb-6 w-full">
          <div className="col-span-1 lg:col-span-1">
            <label className="block mb-2 text-md">交易对</label>
            <div className="flex gap-2">
              <select
                  value={symbol}
                  onChange={handleContractChange}
                  className="w-full p-2 border rounded-md"
                  disabled={isLoading}
              >
                <option value="">选择交易对</option>
                {contractList.map(contract => (
                    <option key={contract.id} value={contract.symbol}>
                      {contract.enName}
                    </option>
                ))}
              </select>
            </div>
          </div>
          <div className="col-span-1 lg:col-span-1">
            <label className="block mb-2 text-md">当前价格</label>
            <div className="flex flex-col gap-1">
              <div className="flex gap-2">
                <input
                    type="number"
                    value={currentPrice}
                    onChange={e => setCurrentPrice(parseFloat(e.target.value))}
                    className="w-full p-2 border rounded-md"
                    disabled={autoRefresh}
                />
              </div>
              <div className="flex items-center gap-2 text-xs">
                <label className="flex items-center cursor-pointer">
                  <input
                      type="checkbox"
                      checked={autoRefresh}
                      onChange={toggleAutoRefresh}
                      className="mr-1"
                  />
                  自动刷新
                </label>
                {autoRefresh && (
                    <span className="text-green-600 text-xs">
                  {lastUpdated ? `${lastUpdated}` : "准备更新..."}
                </span>
                )}
              </div>
            </div>
          </div>
          <div className="col-span-1 lg:col-span-1">
            <label className="block mb-2 text-md">维持保证金率</label>
            <input
                type="number"
                value={maintenanceMarginRate}
                onChange={e => setMaintenanceMarginRate(parseFloat(e.target.value))}
                className="w-full p-2 border rounded-md"
                onClick={() => addToLog(`维持保证金率设置为 ${maintenanceMarginRate} (${maintenanceMarginRate*100}%)`)}
            />
          </div>
          <div className="col-span-1 lg:col-span-1">
            <label className="block mb-2 text-md">合约面值</label>
            <input
                type="number"
                value={contractValue}
                onChange={e => setContractValue(parseFloat(e.target.value))}
                className="w-full p-2 border rounded-md"
                placeholder="0.0001"
                onClick={() => addToLog(`合约面值设置为 ${contractValue}`)}
            />
          </div>
          <div className="col-span-1 lg:col-span-1">
            <label className="block mb-2 text-md">初始余额</label>
            <input
                type="number"
                value={initialBalance.toFixed(4)}
                onChange={e => setInitialBalance(parseFloat(e.target.value))}
                className="w-full p-2 border rounded-md"
                onClick={() => addToLog(`初始余额设置为 ${initialBalance.toFixed(4)}`)}
            />
          </div>
          <div className="col-span-1 lg:col-span-1">
            <label className="block mb-2 text-md">手续费率</label>
            <input
                type="number"
                value={feeRate}
                onChange={e => setFeeRate(parseFloat(e.target.value))}
                className="w-full p-2 border rounded-md"
                onClick={() => addToLog(`手续费率设置为 ${feeRate} (${feeRate*100}%)`)}
            />
          </div>
          <div className="col-span-1 lg:col-span-1 flex items-end">
            <button
                onClick={() => {
                  addToLog(`--- 触发参数更改重新计算 ---`);
                  recalculatePositions();
                }}
                className="bg-blue-500 text-white px-3 py-2 rounded-md text-sm"
            >
              重新计算
            </button>
          </div>
          <div className="col-span-1 lg:col-span-1 flex items-end">
            <button
                onClick={refreshPrice}
                className="mr-2 bg-gray-300 px-3 py-2 rounded-md hover:bg-gray-400 text-sm"
                disabled={isLoading}
            >
              {isLoading ? "..." : "刷新价格"}
            </button>
            <button
                onClick={resetBalance}
                className="bg-yellow-500 text-white px-3 py-2 rounded-md text-sm"
            >
              重置余额
            </button>
          </div>
        </div>

        {/* 仓位创建区 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 bg-white p-3 md:p-4 border rounded-lg mb-4 shadow-sm w-full">
          <div className="col-span-1">
            <label className="block mb-1 text-sm">开仓价格</label>
            <input
                type="number"
                value={entryPrice}
                onChange={e => setEntryPrice(e.target.value)}
                className="w-full p-2 border rounded-md"
            />
          </div>
          <div className="col-span-1">
            <label className="block mb-1 text-sm">张数</label>
            <input
                type="number"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                className="w-full p-2 border rounded-md"
            />
          </div>
          <div className="col-span-1">
            <label className="block mb-1 text-sm">杠杆倍数</label>
            <input
                type="number"
                value={leverage}
                onChange={e => {
                  setLeverage(parseFloat(e.target.value));
                  addToLog(`杠杆倍数设置为 ${e.target.value}x`);
                }}
                className="w-full p-2 border rounded-md"
            />
          </div>
          <div className="col-span-1">
            <label className="block mb-1 text-sm">方向</label>
            <select
                value={direction}
                onChange={e => {
                  setDirection(e.target.value);
                  addToLog(`交易方向设置为 ${e.target.value === 'long' ? '多单' : '空单'}`);
                }}
                className="w-full p-2 border rounded-md"
            >
              <option value="long">多单</option>
              <option value="short">空单</option>
            </select>
          </div>
          <div className="col-span-1">
            <label className="block mb-1 text-sm">仓位类型</label>
            <select
                value={marginType}
                onChange={e => {
                  setMarginType(e.target.value);
                  addToLog(`保证金类型设置为 ${e.target.value === 'cross' ? '全仓' : '逐仓'}`);
                }}
                className="w-full p-2 border rounded-md"
            >
              <option value="cross">全仓</option>
              <option value="isolated">逐仓</option>
            </select>
          </div>
          <div className="col-span-1 flex items-end">
            <button
                onClick={createPosition}
                className="bg-green-600 text-white px-4 py-2 rounded-md w-full text-base"
                disabled={!entryPrice || !quantity}
            >
              创建持仓
            </button>
          </div>
        </div>

        {/* 账户信息行 */}
        <div className="bg-white p-3 md:p-4 border rounded-lg mb-6 shadow-sm w-full">
          <div className="flex flex-wrap items-center gap-3 md:gap-5">
            <div className="flex items-center">
              <span className="mr-1">初始余额:</span>
              <span className="text-blue-500 hover:underline cursor-pointer" onClick={() => addToLog(`初始余额 = ${initialBalance.toFixed(4)}`)}>
              {initialBalance.toFixed(4)}
            </span>
            </div>
            <div className="flex items-center">
              <span className="mr-1">当前余额:</span>
              <span className="text-blue-500 hover:underline cursor-pointer font-bold" onClick={handleLogBalanceHistory}>
              {currentBalance.toFixed(4)}
            </span>
            </div>
            <div className="flex items-center">
              <span className="mr-1">全仓保证金:</span>
              <span className="text-blue-500 hover:underline cursor-pointer" onClick={() => addToLog(`全仓保证金 = ${totalMarginCross.toFixed(4)}`)}>
              {totalMarginCross.toFixed(4)}
            </span>
            </div>
            <div className="flex items-center">
              <span className="mr-1">逐仓保证金:</span>
              <span className="text-blue-500 hover:underline cursor-pointer" onClick={() => addToLog(`逐仓保证金 = ${totalMarginIsolated.toFixed(4)}`)}>
              {totalMarginIsolated.toFixed(4)}
            </span>
            </div>
            {/* 可用资金显示 */}
            <div className="flex items-center">
              <span className="mr-1">可用资金:</span>
              <span className="text-blue-500 hover:underline cursor-pointer" onClick={() => {
                addToLog(`--- 可用余额计算 ---`);
                addToLog(`可用余额计算公式：余额 - 逐仓保证金之和 - 全仓保证金之和 + 当前全仓持仓未实现盈亏之和`);
                addToLog(`逐仓保证金之和: ${accountInfo.totalIsolatedMargin.toFixed(4)}`);
                addToLog(`全仓保证金之和: ${accountInfo.totalCrossMargin.toFixed(4)}`);
                addToLog(`当前全仓持仓未实现盈亏之和: ${accountInfo.totalCrossPnl.toFixed(4)}`);
                addToLog(`计算过程: ${currentBalance.toFixed(4)} - ${accountInfo.totalIsolatedMargin.toFixed(4)} - ${accountInfo.totalCrossMargin.toFixed(4)} + (${accountInfo.totalCrossPnl.toFixed(4)})`);
                addToLog(`= ${accountInfo.availableBalanceFormatted}`);
              }}>
    {accountInfo.availableBalanceFormatted || (accountInfo.availableBalance && accountInfo.availableBalance.toFixed(4)) || "0.00"}
  </span>
            </div>

            {/* 可划转金额显示 */}
            <div className="flex items-center">
              <span className="mr-1">可划转金额:</span>
              <span className="text-green-500 hover:underline cursor-pointer" onClick={() => {
                addToLog(`--- 可划转金额计算 ---`);
                addToLog(`可划转金额计算公式：余额 - 逐仓保证金之和 - 全仓保证金之和 + 当前全仓持仓亏损部分之和`);
                addToLog(`逐仓保证金之和: ${accountInfo.totalIsolatedMargin.toFixed(4)}`);
                addToLog(`全仓保证金之和: ${accountInfo.totalCrossMargin.toFixed(4)}`);
                addToLog(`当前全仓持仓亏损部分之和: ${accountInfo.totalCrossLoss.toFixed(4)} (仅计算亏损的仓位)`);
                addToLog(`计算过程: ${currentBalance.toFixed(4)} - ${accountInfo.totalIsolatedMargin.toFixed(4)} - ${accountInfo.totalCrossMargin.toFixed(4)} + (${accountInfo.totalCrossLoss.toFixed(4)})`);
                addToLog(`= ${accountInfo.transferableBalanceFormatted}`);
              }}>
    {accountInfo.transferableBalanceFormatted || (accountInfo.transferableBalance && accountInfo.transferableBalance.toFixed(4)) || "0.00"}
  </span>
            </div>
            <div className="flex items-center">
              <span className="mr-1">未实现盈亏:</span>
              <span className="text-blue-500 hover:underline cursor-pointer" onClick={() => addToLog(`未实现盈亏总和 = ${totalUnrealizedPnl.toFixed(4)}`)}>
              {totalUnrealizedPnl.toFixed(4)}
            </span>
            </div>
            <div className="flex items-center">
              <span className="mr-1">已实现盈亏:</span>
              <span className="text-blue-500 hover:underline cursor-pointer" onClick={() => addToLog(`已实现盈亏总和 = ${totalRealizedPnl.toFixed(4)}`)}>
              {totalRealizedPnl.toFixed(4)}
            </span>
            </div>
            <div className="flex items-center text-xs text-gray-500 ml-auto">
              <span>用户: {currentUser} | 时间: {currentDateTime}</span>
            </div>
            <div>
              <button onClick={handleAccountMetrics} className="bg-blue-500 text-white px-3 py-1.5 rounded-md text-sm">
                显示计算过程
              </button>
            </div>
          </div>
        </div>

        {/* 持仓列表 */}
        <div className="bg-white p-4 md:p-5 border rounded-lg shadow-sm w-full mb-6">
          <h3 className="text-lg font-bold mb-3">持仓列表</h3>
          <div className="w-full overflow-x-auto" style={{ minWidth: '100%' }}>
            <table className="w-full text-sm border table-auto">
              <thead className="bg-gray-200">
              <tr>
                <th className="p-2 md:p-3 border">交易对</th>
                <th className="p-2 md:p-3 border">方向</th>
                <th className="p-2 md:p-3 border">类型</th>
                <th className="p-2 md:p-3 border">杠杆</th>
                <th className="p-2 md:p-3 border">开仓价</th>
                <th className="p-2 md:p-3 border">当前价</th>
                <th className="p-2 md:p-3 border">爆仓价</th>
                <th className="p-2 md:p-3 border">维持保证金</th>
                <th className="p-2 md:p-3 border">DEX</th>
                <th className="p-2 md:p-3 border">仓位价值</th>
                <th className="p-2 md:p-3 border">未实现盈亏</th>
                <th className="p-2 md:p-3 border">已实现盈亏</th>
                <th className="p-2 md:p-3 border">张数</th>
                <th className="p-2 md:p-3 border">保证金</th>
                <th className="p-2 md:p-3 border">开仓手续费</th>
                <th className="p-2 md:p-3 border">平仓手续费</th>
                <th className="p-2 md:p-3 border">操作</th>
              </tr>
              </thead>
              <tbody>
              {positions.map((pos, idx) => (
                  <tr key={idx} className={isPositionClosed(pos) ? "bg-gray-100" : ""}>
                    <td className="p-2 md:p-3 border text-center">{pos.symbol}</td>
                    <td className="p-2 md:p-3 border text-center">{translateDirection(pos.direction)}</td>
                    <td className="p-2 md:p-3 border text-center">{translateMarginType(pos.marginType)}</td>
                    <td className="p-2 md:p-3 border text-center cursor-pointer text-blue-500 hover:underline" onClick={() => addToLog(`杠杆倍数: ${pos.leverage}x`)}>
                      {pos.leverage}
                    </td>
                    <td className="p-2 md:p-3 border text-center cursor-pointer text-blue-500 hover:underline" onClick={() => addToLog(`开仓价: ${pos.entryPrice}`)}>
                      {pos.entryPrice}
                    </td>
                    <td className="p-2 md:p-3 border text-center cursor-pointer text-blue-500 hover:underline" onClick={() => addToLog(`当前价: ${pos.currentPrice}`)}>
                      {pos.currentPrice}
                    </td>
                    <td
                        className="p-2 md:p-3 border text-blue-500 text-center cursor-pointer hover:underline"
                        onClick={() => isPositionClosed(pos) ? addToLog('该仓位已平仓，无爆仓价格') : handleLogCalculation('liq', pos)}
                    >
                      {isPositionClosed(pos) ? "-" : (
                          <>
                            {pos.liquidationPrice}
                            {pos.isMerged && <span className="text-xs text-yellow-500 ml-1">(合并)</span>}
                          </>
                      )}
                    </td>
                    <td
                        className="p-2 md:p-3 border text-blue-500 text-center cursor-pointer hover:underline"
                        onClick={() => handleLogCalculation('maintenanceMargin', pos)}
                    >
                      {pos.maintenanceMargin}
                    </td>
                    <td
                        className="p-2 md:p-3 border text-blue-500 text-center cursor-pointer hover:underline"
                        onClick={() => isPositionClosed(pos) ? addToLog('该仓位已平仓，无DEX值') : handleLogCalculation('dex', pos)}
                    >
                      {isPositionClosed(pos) ? "-" : (
                          <>
                            {parseFloat(pos.dex).toFixed(4)}
                            {pos.isMerged && <span className="text-xs text-yellow-500 ml-1">(合并)</span>}
                          </>
                      )}
                    </td>
                    <td
                        className="p-2 md:p-3 border text-blue-500 text-center cursor-pointer hover:underline"
                        onClick={() => handleLogCalculation('positionValue', pos)}
                    >
                      {pos.positionValue}
                    </td>
                    <td
                        className="p-2 md:p-3 border text-center cursor-pointer text-blue-500 hover:underline"
                        onClick={() => handleLogCalculation('unrealizedPnl', pos)}
                    >
                      {isPositionClosed(pos) ? "0.00" : parseFloat(pos.unrealizedPnl).toFixed(4)}
                    </td>
                    <td className="p-2 md:p-3 border text-center">
                      {pos.realizedPnl ? (
                          <span className={`text-blue-500 hover:underline cursor-pointer ${parseFloat(pos.realizedPnl) >= 0 ? 'text-green-500' : 'text-red-500'}`} onClick={() => handleLogCalculation('realizedPnl', pos)}>
                        {parseFloat(pos.realizedPnl) >= 0 ? '+' : ''}{pos.realizedPnl}
                      </span>
                      ) : "-"}
                    </td>
                    <td className="p-2 md:p-3 border text-center">{pos.quantity}</td>
                    <td className="p-2 md:p-3 border text-center cursor-pointer text-blue-500 hover:underline" onClick={() => handleLogCalculation('margin', pos)}>
                      {parseFloat(pos.margin).toFixed(4)}
                    </td>
                    <td
                        className="p-2 md:p-3 border text-center cursor-pointer text-blue-500 hover:underline"
                        onClick={() => handleLogCalculation('openFee', pos)}
                    >
                      {pos.openFee}
                    </td>
                    <td
                        className="p-2 md:p-3 border text-center cursor-pointer text-blue-500 hover:underline"
                        onClick={() => handleLogCalculation('closeFee', pos)}
                    >
                      {isPositionClosed(pos) ? pos.closeFee : "0.00"}
                    </td>
                    <td className="p-2 md:p-3 border text-center">
                      {isPositionClosed(pos) ? (
                          <span className="text-gray-400">
                        已平仓@{pos.closePrice}
                      </span>
                      ) : (
                          <div className="flex flex-col items-center gap-1">
                            <button onClick={() => handleClosePosition(idx)} className="bg-red-500 text-white px-2 py-1 rounded-md">平仓</button>
                            <button onClick={() => deletePosition(idx)} className="bg-gray-500 text-white px-2 py-1 rounded-md">删除</button>
                          </div>
                      )}
                    </td>
                  </tr>
              ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 日志控制台 */}
        <div className="bg-black text-green-400 p-4 md:p-5 rounded-lg font-mono text-sm h-auto md:h-[350px]">
          <div className="flex flex-wrap justify-between items-center mb-3">
            <strong className="text-lg flex-grow">计算日志:</strong>
            <div className="flex gap-2 items-center">
              <button onClick={clearLogs} className="bg-gray-700 text-white px-3 py-1.5 rounded-md">清空日志</button>
            </div>
          </div>
          <div className="h-[200px] md:h-[280px] overflow-y-auto pr-1 md:pr-4" style={{ scrollbarWidth: 'thin' }}>
            {logs.map((line, i) => (
                <div key={i} className="whitespace-pre-wrap mb-1 break-words">
                  {line.startsWith('---') ?
                      <div className="text-yellow-300 font-bold mt-3 mb-1">{line}</div> :
                      <div>{line}</div>
                  }
                </div>
            ))}
          </div>
        </div>
      </div>
  );
}