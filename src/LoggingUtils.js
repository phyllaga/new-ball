/**
 * 日志工具函数
 * 包含所有与日志记录相关的功能
 */
import {
  translateDirection,
  calculateDEX,
  calculateUnrealizedPnL,
  calculateRealizedPnL,
  calculatePositionValue,
  calculateMargin,
  calculateMaintenanceMargin,
  calculateOpenFee,
  calculateCloseFee,
  calculateLiquidationPrice,
  mergePositionsBySymbol,
  isPositionClosed, calculateAvailableBalance, calculateTransferableBalance
} from './CalculationUtils';

// 记录合并仓位计算过程
export const logMergedPositionCalculation = (positions, addToLog, contractValue) => {
  const { mergeProcesses } = mergePositionsBySymbol(positions, contractValue);

  // 获取第一个仓位的交易对，用于找到对应的合并过程
  if (positions.length > 0) {
    const symbol = positions[0].symbol;
    if (mergeProcesses[symbol]) {
      mergeProcesses[symbol].forEach(step => addToLog(step));
    }
  }
};

// 记录余额变更历史
export const logBalanceHistory = (positions, initialBalance, currentBalance, addToLog) => {
  addToLog(`--- 余额变更历史 ---`);
  addToLog(`初始余额: ${initialBalance.toFixed(2)}`);

  // 查找所有已平仓的仓位
  const closedPositions = positions.filter(p => isPositionClosed(p));

  if (closedPositions.length > 0) {
    let runningBalance = initialBalance;

    closedPositions.forEach((pos, index) => {
      const posRealizedPnl = parseFloat(pos.realizedPnl);
      const posOpenFee = parseFloat(pos.openFee);
      const posCloseFee = parseFloat(pos.closeFee);

      // 详细展示这笔交易对余额的影响
      addToLog(`\n[${index + 1}] ${pos.symbol} ${translateDirection(pos.direction)} ${pos.quantity}张`);
      addToLog(`  开仓价: ${pos.entryPrice} → 平仓价: ${pos.closePrice}`);
      addToLog(`  已实现盈亏: ${posRealizedPnl >= 0 ? '+' : ''}${posRealizedPnl.toFixed(2)}`);
      addToLog(`  开仓手续费: -${posOpenFee.toFixed(4)}`);
      addToLog(`  平仓手续费: -${posCloseFee.toFixed(4)}`);

      // 计算影响
      const totalFees = posOpenFee + posCloseFee;
      const netImpact = posRealizedPnl - totalFees;

      addToLog(`  --- 余额计算过程 ---`);
      addToLog(`  交易前余额: ${runningBalance.toFixed(2)}`);
      addToLog(`  计算公式: 交易前余额 + 已实现盈亏 - 总手续费`);
      addToLog(`  计算过程: ${runningBalance.toFixed(2)} + ${posRealizedPnl.toFixed(2)} - ${totalFees.toFixed(4)}`);

      // 更新运行中的余额
      runningBalance = runningBalance + netImpact;

      addToLog(`  = ${runningBalance.toFixed(2)}`);
      addToLog(`  交易后余额: ${runningBalance.toFixed(2)}`);
    });

    // 确认最终余额
    if (Math.abs(runningBalance - currentBalance) < 0.0001) {
      addToLog(`\n最终余额: ${currentBalance.toFixed(2)} (计算正确)`);
    } else {
      addToLog(`\n最终余额: ${currentBalance.toFixed(2)}`);
      addToLog(`计算所得余额: ${runningBalance.toFixed(2)}`);
      addToLog(`注意: 最终余额与计算所得余额有差异，可能存在其他因素影响`);
    }
  } else {
    addToLog(`尚无平仓记录，当前余额与初始余额相同: ${currentBalance.toFixed(2)}`);
  }
};

// 记录各种计算
export const logCalculation = (type, pos, currentPrice, contractValue, feeRate, maintenanceMarginRate, positions, addToLog, currentUser, currentDateTime, currentBalance) => {
  addToLog(`用户: ${currentUser}`);
  addToLog(`时间: ${currentDateTime} (UTC)`);

  let calculationResult = null;

  switch(type) {
    case 'unrealizedPnl':
      calculationResult = calculateUnrealizedPnL(pos, contractValue);
      break;
    case 'realizedPnl':
      calculationResult = calculateRealizedPnL(pos, contractValue);
      break;
    case 'liq':
      calculationResult = calculateLiquidationPrice(pos, contractValue);
      break;
    case 'margin':
      calculationResult = calculateMargin(pos,contractValue);
      break;
    case 'maintenanceMargin':
      calculationResult = calculateMaintenanceMargin(pos, contractValue, maintenanceMarginRate);
      break;
    case 'openFee':
      calculationResult = calculateOpenFee(pos, feeRate);
      break;
    case 'closeFee':
      calculationResult = calculateCloseFee(pos, contractValue, feeRate);
      break;
    case 'positionValue':
      calculationResult = calculatePositionValue(pos, contractValue);
      break;
    case 'dex':
      calculationResult = calculateDEX(pos, positions, currentBalance, contractValue);
      break;
    default:
      addToLog(`未知计算类型: ${type}`);
      return;
  }

  // 输出计算步骤
  if (calculationResult && calculationResult.steps) {
    calculationResult.steps.forEach(step => addToLog(step));
  }
};

// 账户信息计算日志记录
// 更新logAccountMetrics函数
export const logAccountMetrics = (props) => {
  const {
    positions, initialBalance, currentBalance, currentUser, currentDateTime,
    totalMarginCross, totalMarginIsolated, totalMargin, totalOpenFee,
    totalCloseFee, totalFee, totalUnrealizedPnl, totalRealizedPnl,
    availableBalance, transferableBalance, contractValue, addToLog, steps = []
  } = props;

  addToLog(`--- 账户指标计算 ---`);
  addToLog(`用户: ${currentUser || "z"}`);
  addToLog(`时间: ${currentDateTime || "2025-05-19 07:11:14"} (UTC)`);

  // 如果有预先计算好的步骤，直接显示
  if (steps && steps.length > 0) {
    steps.forEach(step => addToLog(step));
    return;
  }

  // 基本账户信息
  addToLog(`初始余额: ${initialBalance.toFixed(2)}`);
  addToLog(`当前余额: ${currentBalance.toFixed(2)}`);

  // 计算可用余额和可划转金额
  const { availableBalance: calcAvailableBalance, steps: availableBalanceSteps } =
      calculateAvailableBalance(positions, currentBalance);

  const { transferableBalance: calcTransferableBalance, steps: transferableSteps } =
      calculateTransferableBalance(positions, currentBalance);

  addToLog(`可用余额: ${calcAvailableBalance}`);
  addToLog(`可划转金额: ${calcTransferableBalance}`);

  // 显示详细计算步骤
  addToLog(`\n--- 可用余额计算 ---`);
  availableBalanceSteps.forEach(step => addToLog(step));

  addToLog(`\n--- 可划转金额计算 ---`);
  transferableSteps.forEach(step => addToLog(step));

  // 显示余额变更历史
  const closedPositions = positions.filter(p => isPositionClosed(p));
  if (closedPositions.length > 0) {
    logBalanceHistory(positions, initialBalance, currentBalance, addToLog);
  }
};