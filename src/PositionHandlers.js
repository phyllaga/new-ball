/**
 * 仓位操作函数
 * 包含所有与仓位创建、修改、删除相关的函数
 */
import { calculateAllDEX, calculateLiquidationPrices, calculatePositionValues } from './CalculationUtils';

// 创建新仓位
export const createNewPosition = (props) => {
  const {
    symbol, direction, entryPrice, quantity, currentPrice, leverage,
    marginType, contractValue, feeRate, maintenanceMarginRate, addToLog,dex,
    currentDateTime, currentUser
  } = props;

  const ep = parseFloat(entryPrice);
  const qty = parseFloat(quantity);

  // 详细记录计算过程
  addToLog(`--- 创建新仓位 ---`);
  addToLog(`用户: ${currentUser}`);
  addToLog(`时间: ${currentDateTime} (UTC)`);

  const positionValue = qty * contractValue * ep;
  addToLog(`仓位价值计算公式：数量 × 合约面值 × 开仓价`);
  addToLog(`计算过程：${qty} × ${contractValue} × ${ep} = ${positionValue.toFixed(4)}`);

  const margin = positionValue / leverage;
  addToLog(`保证金计算公式：仓位价值 ÷ 杠杆`);
  addToLog(`计算过程：${positionValue.toFixed(4)} ÷ ${leverage} = ${margin.toFixed(4)}`);

  const openFee = positionValue * feeRate;
  addToLog(`开仓手续费计算公式：仓位价值 × 手续费率`);
  addToLog(`计算过程：${positionValue.toFixed(4)} × ${feeRate} = ${openFee.toFixed(4)}`);

  // 计算维持保证金
  const maintenanceMargin = qty * ep * contractValue * maintenanceMarginRate;
  addToLog(`维持保证金计算公式：持仓张数 × 开仓均价 × 面值 × 维持保证金率`);
  addToLog(`计算过程：${qty} × ${ep} × ${contractValue} × ${maintenanceMarginRate} = ${maintenanceMargin.toFixed(4)}`);

  // 先计算未实现盈亏
  const delta = direction === 'long' ? currentPrice - ep : ep - currentPrice;
  const unrealizedPnl = (delta * qty * contractValue).toFixed(2);

  addToLog(`未实现盈亏计算公式：${direction === 'long' ? '(当前价 - 开仓价)' : '(开仓价 - 当前价)'} × 数量 × 合约面值`);
  addToLog(`计算过程：${direction === 'long' ? `(${currentPrice} - ${ep})` : `(${ep} - ${currentPrice})`} × ${qty} × ${contractValue}`);
  addToLog(`= ${delta.toFixed(4)} × ${qty} × ${contractValue}`);
  addToLog(`= ${unrealizedPnl}`);

  // 创建新仓位对象
  return {
    symbol,
    direction,
    entryPrice: ep,
    quantity: qty,
    currentPrice,
    leverage,
    marginType,
    status: 'open',
    positionValue: positionValue.toFixed(4),
    margin: margin.toFixed(2),
    openFee: openFee.toFixed(4),
    closeFee: "0.00",  // 初始平仓手续费为0
    maintenanceMargin: maintenanceMargin.toFixed(4),
    unrealizedPnl,
    realizedPnl: null,
    dex:0,
    createdAt: new Date().toISOString(),
    closePrice: null,
    closedAt: null
  };
};

// 平仓函数 - 修改为立即重新计算所有仓位
export const closePosition = (props) => {
  const {
    position, index, closePrice, positions, currentBalance,
    contractValue, feeRate, maintenanceMarginRate, addToLog,
    currentUser, currentDateTime
  } = props;

  const updated = [...positions];
  const pos = updated[index];

  // 计算平仓盈亏
  const delta = pos.direction === 'long' ? closePrice - pos.entryPrice : pos.entryPrice - closePrice;
  const pnl = delta * pos.quantity * contractValue;

  // 计算平仓手续费
  const closingValue = pos.quantity * contractValue * closePrice;
  const closingFee = closingValue * feeRate;

  // 确保开仓手续费是正确的数值
  const openFee = parseFloat(pos.openFee);

  // 平仓后更新当前余额 = 当前余额 + 盈亏 - 平仓手续费
  const newBalance = currentBalance + pnl - closingFee;

  addToLog(`--- 平仓操作 ---`);
  addToLog(`用户: ${currentUser}`);
  addToLog(`时间: ${currentDateTime} (UTC)`);
  addToLog(`仓位: ${pos.symbol} ${pos.direction === 'long' ? '多单' : '空单'} ${pos.quantity}张 @${pos.entryPrice}`);
  addToLog(`平仓价格: ${closePrice}`);

  const formula = pos.direction === 'long' ? '(平仓价 - 开仓价)' : '(开仓价 - 平仓价)';
  addToLog(`已实现盈亏计算公式：${formula} × 数量 × 合约面值`);
  addToLog(`计算过程：${pos.direction === 'long' ? `(${closePrice} - ${pos.entryPrice})` : `(${pos.entryPrice} - ${closePrice})`} × ${pos.quantity} × ${contractValue}`);
  addToLog(`= ${delta.toFixed(4)} × ${pos.quantity} × ${contractValue}`);
  addToLog(`= ${pnl.toFixed(2)}`);

  addToLog(`开仓手续费计算公式：仓位价值(开仓时) × 手续费率`);
  addToLog(`计算过程：${pos.quantity} × ${contractValue} × ${pos.entryPrice} × ${feeRate} = ${openFee.toFixed(4)}`);

  addToLog(`平仓手续费计算公式：仓位价值(平仓时) × 手续费率`);
  addToLog(`计算过程：${pos.quantity} × ${contractValue} × ${closePrice} × ${feeRate} = ${closingFee.toFixed(4)}`);

  addToLog(`余额变化计算公式：当前余额 + 盈亏 - 平仓手续费`);
  addToLog(`计算过程：${currentBalance.toFixed(2)} + ${pnl.toFixed(2)} - ${closingFee.toFixed(4)}`);
  addToLog(`= ${newBalance.toFixed(2)}`);

  // 更新仓位状态
  pos.closed = true;
  pos.closePrice = closePrice;
  pos.realizedPnl = pnl.toFixed(2);  // 设置已实现盈亏
  pos.unrealizedPnl = "0.00";        // 平仓后未实现盈亏为0
  pos.closeFee = closingFee.toFixed(4); // 单独记录平仓手续费
  pos.closedAt = new Date().toISOString();

  addToLog(`仓位已平仓，新余额: ${newBalance.toFixed(2)}`);

  // 平仓后立即重新计算所有仓位的DEX和爆仓价
  addToLog(`--- 余额变化后重新计算所有仓位 ---`);

  // 重新计算所有未平仓位的基础值、DEX和爆仓价
  let recalculatedPositions = updated.map(p => {
    if (p.closed) return p;
    return calculatePositionValues(p, p.currentPrice, contractValue, feeRate, maintenanceMarginRate);
  });

  // 使用新余额计算DEX
  recalculatedPositions = calculateAllDEX(recalculatedPositions, newBalance, contractValue);

  // 计算新的爆仓价
  recalculatedPositions = calculateLiquidationPrices(recalculatedPositions, contractValue);

  // 记录重新计算后的结果
  const activePositions = recalculatedPositions.filter(p => !p.closed);
  if (activePositions.length > 0) {
    addToLog(`平仓后余额变化导致DEX和爆仓价更新：`);
    activePositions.forEach(p => {
      addToLog(`  ${p.symbol} ${p.direction === 'long' ? '多单' : '空单'} ${p.quantity}张: DEX=${p.dex}, 爆仓价=${p.liquidationPrice}`);
    });
  }

  return {
    updatedPositions: recalculatedPositions,
    newBalance
  };
};

// 重新计算所有仓位
export const recalculateAllPositions = (props) => {
  const {
    positions, currentPrice, contractValue, feeRate,
    maintenanceMarginRate, currentBalance, addToLog,
    currentUser, currentDateTime, isAutoRefresh = false
  } = props;

  if (!isAutoRefresh) {
    addToLog(`--- 重新计算所有仓位 ---`);
    addToLog(`用户: ${currentUser}`);
    addToLog(`时间: ${currentDateTime} (UTC)`);
  }

  // 重新计算所有仓位的基础值：仓位价值、保证金、手续费、维持保证金和未实现盈亏
  let updatedPositions = positions.map(pos => {
    if (pos.closed) return pos;

    return calculatePositionValues(
        pos, currentPrice, contractValue, feeRate, maintenanceMarginRate
    );
  });

  // 计算所有仓位的DEX
  if (!isAutoRefresh) {
    addToLog(`--- 更新所有仓位DEX ---`);
  }

  const positionsWithDex = calculateAllDEX(updatedPositions, currentBalance, contractValue);

  // 基于更新的DEX计算爆仓价
  if (!isAutoRefresh) {
    addToLog(`--- 计算爆仓价格 ---`);
  }

  const finalPositions = calculateLiquidationPrices(positionsWithDex, contractValue);

  // 显示每个仓位的DEX和爆仓价更新
  if (!isAutoRefresh) {
    finalPositions.filter(p => !p.closed).forEach(pos => {
      const positionValue = parseFloat(pos.positionValue);

      addToLog(`仓位: ${pos.symbol} ${pos.direction === 'long' ? '多单' : '空单'} ${pos.quantity}张:`);
      addToLog(`  DEX: ${pos.dex}`);

      if (pos.direction === 'long') {
        addToLog(`  多仓爆仓价计算: (${positionValue.toFixed(4)} - ${pos.dex}) ÷ (${pos.quantity} × ${contractValue}) = ${pos.liquidationPrice}`);
      } else {
        addToLog(`  空仓爆仓价计算: (${positionValue.toFixed(4)} + ${pos.dex}) ÷ (${pos.quantity} × ${contractValue}) = ${pos.liquidationPrice}`);
      }
    });
  }

  return finalPositions;
};