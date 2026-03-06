/**
 * 计算工具函数
 * 包含所有与合约交易计算相关的功能
 */

// 翻译方向和保证金类型
export const translateDirection = (dir) => dir === 'long' ? '多单' : '空单';
export const translateMarginType = (type) => type === 'cross' ? '全仓' : '逐仓';

export const isPositionClosed = (position) => {
  return position.closed === true;
};

/**
 * 计算未实现盈亏，并返回计算过程
 */
export const calculateUnrealizedPnL = (pos, contractValue) => {
  if (isPositionClosed(pos)) {
    return {
      result: "0.00",
      steps: ["该仓位已平仓，未实现盈亏为0"]
    };
  }

  const formula = pos.direction === 'long' ? '(当前价 - 开仓价)' : '(开仓价 - 当前价)';
  const delta = pos.direction === 'long'
      ? pos.currentPrice - pos.entryPrice
      : pos.entryPrice - pos.currentPrice;

  const result = (delta * pos.quantity * contractValue).toFixed(2);

  const steps = [
    `未实现盈亏计算公式：${formula} × 数量 × 合约面值`,
    `计算过程：${pos.direction === 'long' ? `(${pos.currentPrice} - ${pos.entryPrice})` : `(${pos.entryPrice} - ${pos.currentPrice})`} × ${pos.quantity} × ${contractValue}`,
    `= ${delta.toFixed(4)} × ${pos.quantity} × ${contractValue}`,
    `= ${result}`
  ];

  return { result, steps };
};

/**
 * 计算已实现盈亏，并返回计算过程
 */
export const calculateRealizedPnL = (pos, contractValue) => {
  if (!isPositionClosed(pos) || pos.realizedPnl === null) {
    return {
      result: null,
      steps: ["该仓位尚未平仓，暂无已实现盈亏"]
    };
  }

  const formula = pos.direction === 'long' ? '(平仓价 - 开仓价)' : '(开仓价 - 平仓价)';
  const delta = pos.direction === 'long'
      ? pos.closePrice - pos.entryPrice
      : pos.entryPrice - pos.closePrice;

  const result = (delta * pos.quantity * contractValue).toFixed(2);

  const steps = [
    `已实现盈亏计算公式：${formula} × 数量 × 合约面值`,
    `计算过程：${pos.direction === 'long' ? `(${pos.closePrice} - ${pos.entryPrice})` : `(${pos.entryPrice} - ${pos.closePrice})`} × ${pos.quantity} × ${contractValue}`,
    `= ${delta.toFixed(4)} × ${pos.quantity} × ${contractValue}`,
    `= ${result}`
  ];

  return { result, steps };
};

/**
 * 计算仓位价值，并返回计算过程
 */
export const calculatePositionValue = (pos, contractValue) => {
  const price = pos.currentPrice || pos.entryPrice;
  const value = pos.quantity * contractValue * price;
  const result = value.toFixed(4);

  const steps = [
    `仓位价值计算公式：数量 × 合约面值 × 当前价`,
    `计算过程：${pos.quantity} × ${contractValue} × ${price} = ${result}`
  ];

  return { result, steps };
};

/**
 * 计算保证金，并返回计算过程
 */
export const calculateMargin = (pos, contractValue) => {
  // 使用持仓张数、开仓均价、面值和杠杆直接计算
  const quantity = parseFloat(pos.quantity);
  const entryPrice = parseFloat(pos.entryPrice);
  const leverage = parseFloat(pos.leverage);

  // 保证金计算
  const positionValue = quantity * entryPrice * contractValue; // 仓位价值
  const margin = positionValue / leverage;
  const result = margin.toFixed(2);

  const steps = [
    `保证金计算公式：持仓张数 × 开仓均价 × 面值 ÷ 杠杆`,
    `计算过程：${quantity} × ${entryPrice} × ${contractValue} ÷ ${leverage}`,
    `= ${positionValue.toFixed(4)} ÷ ${leverage}`,
    `= ${result}`
  ];

  return { result, steps };
};

/**
 * 计算维持保证金，并返回计算过程
 */
export const calculateMaintenanceMargin = (pos, contractValue, maintenanceMarginRate) => {
  const mm = parseFloat(pos.quantity) * parseFloat(pos.entryPrice) * contractValue * maintenanceMarginRate;
  const result = mm.toFixed(4);

  const steps = [
    `维持保证金计算公式：持仓张数 × 开仓均价 × 面值 × 维持保证金率`,
    `计算过程：${pos.quantity} × ${pos.entryPrice} × ${contractValue} × ${maintenanceMarginRate} = ${result}`
  ];

  return { result, steps };
};

/**
 * 计算开仓手续费，并返回计算过程
 */
export const calculateOpenFee = (pos, feeRate) => {
  const positionValue = parseFloat(pos.positionValue);
  const fee = positionValue * feeRate;
  const result = fee.toFixed(4);

  const steps = [
    `开仓手续费计算公式：仓位价值 × 手续费率`,
    `计算过程：${positionValue.toFixed(4)} × ${feeRate} = ${result}`
  ];

  return { result, steps };
};

/**
 * 计算平仓手续费，并返回计算过程
 */
export const calculateCloseFee = (pos, contractValue, feeRate) => {
  if (!isPositionClosed(pos)) {
    return {
      result: "0.00",
      steps: ["该仓位尚未平仓，暂无平仓手续费"]
    };
  }

  const closingValue = pos.quantity * contractValue * pos.closePrice;
  const fee = closingValue * feeRate;
  const result = fee.toFixed(4);

  const steps = [
    `平仓手续费计算公式：仓位价值(平仓时) × 手续费率`,
    `计算过程：${closingValue.toFixed(4)} × ${feeRate} = ${result}`
  ];

  return { result, steps };
};

/**
 * 计算仓位基础值，并返回更新后的仓位
 */
export const calculatePositionValues = (pos, currentPrice, contractValue, feeRate, maintenanceMarginRate) => {
  if (isPositionClosed(pos)) return pos;

  // 获取基础数值
  const quantity = parseFloat(pos.quantity);
  const entryPrice = parseFloat(pos.entryPrice);
  const leverage = parseFloat(pos.leverage);

  // 计算仓位价值 (使用当前价格)
  const positionValue = quantity * contractValue * currentPrice;

  // 计算保证金 (使用开仓均价和公式: 持仓张数 × 开仓均价 × 面值 ÷ 杠杆)
  const marginValue = quantity * entryPrice * contractValue;
  const margin = marginValue / leverage;

  // 计算维持保证金 (使用开仓均价)
  const maintenanceMargin = quantity * entryPrice * contractValue * maintenanceMarginRate;

  // 计算未实现盈亏
  const delta = pos.direction === 'long'
      ? currentPrice - entryPrice
      : entryPrice - currentPrice;
  const unrealizedPnl = (delta * quantity * contractValue).toFixed(2);

  return {
    ...pos,
    currentPrice,
    positionValue: positionValue.toFixed(4),
    margin: margin.toFixed(2),
    maintenanceMargin: maintenanceMargin.toFixed(4),
    unrealizedPnl
  };
};
/**
 * 计算账户可划转金额
 * 可划转金额 = 余额 - 逐仓保证金之和 - 全仓保证金之和 + 当前全仓持仓亏损部分之和
 */
export const calculateTransferableBalance = (positions, currentBalance) => {
  // 确保currentBalance是数字
  const balance = parseFloat(currentBalance || 0);

  // 逐仓保证金之和
  const totalIsolatedMargin = positions
      .filter(p => p.marginType === 'isolated' && !isPositionClosed(p))
      .reduce((sum, p) => sum + parseFloat(p.margin || 0), 0);

  // 全仓保证金之和
  const totalCrossMargin = positions
      .filter(p => p.marginType === 'cross' && !isPositionClosed(p))
      .reduce((sum, p) => sum + parseFloat(p.margin || 0), 0);

  // 当前全仓持仓亏损部分之和（仅计算亏损的仓位，盈利的不计入）
  const totalCrossLoss = positions
      .filter(p => p.marginType === 'cross' && !isPositionClosed(p) && parseFloat(p.unrealizedPnl || 0) < 0)
      .reduce((sum, p) => sum + parseFloat(p.unrealizedPnl || 0), 0);

  // 计算可划转金额
  const transferableBalance = balance - totalIsolatedMargin - totalCrossMargin + totalCrossLoss;
  const transferableBalanceFormatted = transferableBalance.toFixed(2); // 格式化

  // 生成计算步骤说明
  const transferableSteps = [
    `可划转金额计算公式：余额 - 逐仓保证金之和 - 全仓保证金之和 + 当前全仓持仓亏损部分之和`,
    `逐仓保证金之和: ${totalIsolatedMargin.toFixed(2)}`,
    `全仓保证金之和: ${totalCrossMargin.toFixed(2)}`,
    `当前全仓持仓亏损部分之和: ${totalCrossLoss.toFixed(2)} (仅计算亏损的仓位)`,
    `计算过程: ${balance.toFixed(2)} - ${totalIsolatedMargin.toFixed(2)} - ${totalCrossMargin.toFixed(2)} + (${totalCrossLoss.toFixed(2)})`,
    `= ${transferableBalanceFormatted}`
  ];

  return {
    transferableBalance,  // 返回数值
    transferableBalanceFormatted, // 提供格式化版本
    steps: transferableSteps,
    totalIsolatedMargin,
    totalCrossMargin,
    totalCrossLoss
  };
};

/**
 * 计算账户可用余额
 * 可用余额 = 余额 - 逐仓保证金之和 - 全仓保证金之和 + 当前全仓持仓未实现盈亏之和
 */
export const calculateAvailableBalance = (positions, currentBalance) => {
  // 确保currentBalance是数字
  const balance = parseFloat(currentBalance || 0);

  // 逐仓保证金之和
  const totalIsolatedMargin = positions
      .filter(p => p.marginType === 'isolated' && !isPositionClosed(p))
      .reduce((sum, p) => sum + parseFloat(p.margin || 0), 0);

  // 全仓保证金之和
  const totalCrossMargin = positions
      .filter(p => p.marginType === 'cross' && !isPositionClosed(p))
      .reduce((sum, p) => sum + parseFloat(p.margin || 0), 0);

  // 当前全仓持仓未实现盈亏之和（计算全部未实现盈亏，包括盈利和亏损）
  const totalCrossPnl = positions
      .filter(p => p.marginType === 'cross' && !isPositionClosed(p))
      .reduce((sum, p) => sum + parseFloat(p.unrealizedPnl || 0), 0);

  // 计算可用余额
  const availableBalance = balance - totalIsolatedMargin - totalCrossMargin + totalCrossPnl;
  const availableBalanceFormatted = availableBalance.toFixed(2); // 格式化

  // 生成计算步骤说明
  const steps = [
    `可用余额计算公式：余额 - 逐仓保证金之和 - 全仓保证金之和 + 当前全仓持仓未实现盈亏之和`,
    `逐仓保证金之和: ${totalIsolatedMargin.toFixed(2)}`,
    `全仓保证金之和: ${totalCrossMargin.toFixed(2)}`,
    `当前全仓持仓未实现盈亏之和: ${totalCrossPnl.toFixed(2)}`,
    `计算过程: ${balance.toFixed(2)} - ${totalIsolatedMargin.toFixed(2)} - ${totalCrossMargin.toFixed(2)} + (${totalCrossPnl.toFixed(2)})`,
    `= ${availableBalanceFormatted}`
  ];

  return {
    availableBalance,  // 数值
    availableBalanceFormatted,  // 格式化字符串
    steps,
    totalIsolatedMargin,
    totalCrossMargin,
    totalCrossPnl
  };
};



/**
 * 合并同一交易对的全仓仓位，并返回合并过程和结果
 */
export const mergePositionsBySymbol = (positions, contractValue) => {
  // 分离全仓和逐仓仓位
  const crossPositions = positions.filter(p => p.marginType === 'cross' && !isPositionClosed(p));
  const otherPositions = positions.filter(p => p.marginType !== 'cross' || isPositionClosed(p));

  // 按交易对分组全仓仓位
  const symbolGroups = {};
  crossPositions.forEach(pos => {
    if (!symbolGroups[pos.symbol]) {
      symbolGroups[pos.symbol] = [];
    }
    symbolGroups[pos.symbol].push(pos);
  });

  // 记录合并过程
  const mergeProcesses = {};

  // 合并结果数组
  const mergedPositions = [...otherPositions];

  // 处理每个交易对的全仓仓位组
  Object.keys(symbolGroups).forEach(symbol => {
    const positions = symbolGroups[symbol];

    // 如果只有一个仓位，无需合并
    if (positions.length === 1) {
      mergedPositions.push(positions[0]);
      return;
    }

    // 记录合并过程
    const process = [`\n--- ${symbol} 全仓仓位合并计算 ---`];

    // 分离多空仓位并计算总量
    let longQuantity = 0;
    let longValue = 0;
    let shortQuantity = 0;
    let shortValue = 0;

    positions.forEach((pos, idx) => {
      if (pos.direction === 'long') {
        process.push(`[多仓 ${idx+1}] ${pos.quantity}张 × ${pos.entryPrice} × ${contractValue} = ${(pos.quantity * pos.entryPrice * contractValue).toFixed(4)}`);
        longQuantity += parseFloat(pos.quantity);
        longValue += parseFloat(pos.quantity) * parseFloat(pos.entryPrice) * contractValue;
      } else {
        process.push(`[空仓 ${idx+1}] ${pos.quantity}张 × ${pos.entryPrice} × ${contractValue} = ${(pos.quantity * pos.entryPrice * contractValue).toFixed(4)}`);
        shortQuantity += parseFloat(pos.quantity);
        shortValue += parseFloat(pos.quantity) * parseFloat(pos.entryPrice) * contractValue;
      }
    });

    process.push(`\n多仓总量: ${longQuantity}张, 价值: ${longValue.toFixed(4)}`);
    process.push(`空仓总量: ${shortQuantity}张, 价值: ${shortValue.toFixed(4)}`);

    // 计算净仓位
    const netQuantity = longQuantity - shortQuantity;
    process.push(`净仓位: ${netQuantity}张 (${netQuantity > 0 ? "多" : "空"}方向)`);

    // 如果净仓位为0，不添加合并仓位
    if (Math.abs(netQuantity) < 0.00001) {
      process.push(`多空仓位抵消，净仓位为0，无需计算DEX和爆仓价`);
      mergeProcesses[symbol] = process;
      return;
    }

    // 确定方向和计算均价
    const direction = netQuantity > 0 ? 'long' : 'short';
    let avgEntryPrice;

    if (direction === 'long') {
      // 多仓占优，计算均价
      avgEntryPrice = (longValue - shortValue) / (netQuantity * contractValue);
      process.push(`\n合并后计算公式: (多仓价值 - 空仓价值) ÷ (净多仓量 × 合约面值)`);
      process.push(`计算过程: (${longValue.toFixed(4)} - ${shortValue.toFixed(4)}) ÷ (${netQuantity} × ${contractValue})`);
      process.push(`= ${(longValue - shortValue).toFixed(4)} ÷ ${(netQuantity * contractValue).toFixed(4)}`);
      process.push(`= ${avgEntryPrice.toFixed(4)}`);
    } else {
      // 空仓占优，计算均价
      avgEntryPrice = (shortValue - longValue) / (Math.abs(netQuantity) * contractValue);
      process.push(`\n合并后计算公式: (空仓价值 - 多仓价值) ÷ (净空仓量 × 合约面值)`);
      process.push(`计算过程: (${shortValue.toFixed(4)} - ${longValue.toFixed(4)}) ÷ (${Math.abs(netQuantity)} × ${contractValue})`);
      process.push(`= ${(shortValue - longValue).toFixed(4)} ÷ ${(Math.abs(netQuantity) * contractValue).toFixed(4)}`);
      process.push(`= ${avgEntryPrice.toFixed(4)}`);
    }

    process.push(`\n合并后仓位: ${Math.abs(netQuantity)}张 ${direction === 'long' ? "多单" : "空单"} @${avgEntryPrice.toFixed(4)}`);

    // 计算保证金总和
    const totalMargin = positions.reduce((sum, pos) => sum + parseFloat(pos.margin), 0);
    process.push(`保证金总和: ${totalMargin.toFixed(2)}`);

    // 计算仓位价值和杠杆
    const positionValue = Math.abs(netQuantity) * avgEntryPrice * contractValue;
    const leverage = positionValue / totalMargin;
    process.push(`仓位价值: ${positionValue.toFixed(4)}`);
    process.push(`实际杠杆: ${leverage.toFixed(2)}x`);

    // 创建合并仓位
    const mergedPosition = {
      ...positions[0],
      direction,
      quantity: Math.abs(netQuantity),
      entryPrice: avgEntryPrice,
      isMerged: true, // 标记为合并仓位
      mergeInfo: {
        longQuantity,
        longValue,
        shortQuantity,
        shortValue,
        netQuantity,
        originalPositions: positions
      }
    };

    // 重新计算合并仓位的关键数据
    mergedPosition.positionValue = positionValue.toFixed(4);
    mergedPosition.margin = totalMargin.toFixed(2);
    mergedPosition.leverage = leverage.toFixed(2);

    // 保存合并过程
    mergeProcesses[symbol] = process;

    // 添加合并后的仓位
    mergedPositions.push(mergedPosition);
  });

  return { mergedPositions, mergeProcesses };
};

/**
 * 计算全仓DEX，并返回计算过程
 */
export const calculateCrossDEX = (pos, positions, currentBalance, contractValue) => {
  // 获取活跃仓位
  const activePositions = positions.filter(p => !isPositionClosed(p));

  // 分离全仓和逐仓仓位
  const crossPositions = activePositions.filter(p => p.marginType === 'cross');
  const isolatedPositions = activePositions.filter(p => p.marginType === 'isolated');

  // 计算总的维持保证金
  const totalMaintenanceMargin = activePositions.reduce(
      (sum, p) => sum + parseFloat(p.maintenanceMargin || 0), 0
  );

  // 记录维持保证金计算过程
  const mmSteps = [`\n维持保证金之和计算：`];
  activePositions.forEach(p => {
    mmSteps.push(`  ${p.symbol} ${translateDirection(p.direction)} ${p.quantity}张: ${p.maintenanceMargin}`);
  });
  mmSteps.push(`维持保证金总和：${totalMaintenanceMargin.toFixed(4)}`);

  // 计算总手续费
  const totalFees = activePositions.reduce(
      (sum, p) => sum + parseFloat(p.openFee || 0), 0
  );

  // 记录手续费计算过程
  const feeSteps = [`\n手续费之和计算：`];
  activePositions.forEach(p => {
    feeSteps.push(`  ${p.symbol} ${translateDirection(p.direction)} ${p.quantity}张: ${p.openFee}`);
  });
  feeSteps.push(`手续费总和：${totalFees.toFixed(4)}`);

  // 计算总逐仓保证金
  const totalIsolatedMargin = isolatedPositions.reduce(
      (sum, p) => sum + parseFloat(p.margin || 0), 0
  );

  // 记录逐仓保证金计算过程
  const isoMarginSteps = [`\n逐仓保证金之和计算：`];
  if (isolatedPositions.length > 0) {
    isolatedPositions.forEach(p => {
      isoMarginSteps.push(`  ${p.symbol} ${translateDirection(p.direction)} ${p.quantity}张: ${p.margin}`);
    });
  }
  isoMarginSteps.push(`逐仓保证金总和：${totalIsolatedMargin.toFixed(4)}`);

  // 计算除本仓位外其他仓位的未实现盈亏
  const otherPnlSteps = [`\n除本交易对外其他仓位的未实现盈亏计算：`];
  const otherPositionsUnrealizedPnl = activePositions.reduce((sum, p) => {
    if (p.symbol !== pos.symbol) {
      otherPnlSteps.push(`  ${p.symbol} ${translateDirection(p.direction)} ${p.quantity}张: ${p.unrealizedPnl}`);
      return sum + parseFloat(p.unrealizedPnl || 0);
    }
    return sum;
  }, 0);
  otherPnlSteps.push(`其他仓位未实现盈亏总和：${otherPositionsUnrealizedPnl.toFixed(4)}`);

  // 计算最终全仓DEX
  const dex = currentBalance - totalMaintenanceMargin - totalFees - totalIsolatedMargin + otherPositionsUnrealizedPnl;

  // 记录最终计算过程
  const finalSteps = [`\n全仓DEX最终计算过程：`];
  finalSteps.push(`${currentBalance} - ${totalMaintenanceMargin.toFixed(4)} - ${totalFees.toFixed(4)} - ${totalIsolatedMargin.toFixed(4)} + ${otherPositionsUnrealizedPnl.toFixed(4)}`);
  finalSteps.push(`= ${dex.toFixed(4)}`);

  const steps = [
    `\n全仓DEX计算公式：余额 - 全仓未平仓位维持保证金之和 - 全仓未平仓位手续费之和 - 逐仓未平仓位保证金之和 + 除本交易对以外其他全仓未平仓位仓位的未实现盈亏之和`,
    ...mmSteps,
    ...feeSteps,
    ...isoMarginSteps,
    ...otherPnlSteps,
    ...finalSteps
  ];

  return { result: dex.toFixed(2), steps };
};

/**
 * 计算逐仓DEX，并返回计算过程
 */
export const calculateIsolatedDEX = (pos) => {
  const margin = parseFloat(pos.margin);
  const maintenanceMargin = parseFloat(pos.maintenanceMargin);
  const openFee = parseFloat(pos.openFee);

  const steps = [
    `\n逐仓DEX计算公式：仓位上的保证金 - 仓位维持保证金 - 仓位手续费`,
    `仓位保证金: ${margin.toFixed(4)}`,
    `仓位维持保证金: ${maintenanceMargin.toFixed(4)}`,
    `仓位手续费: ${openFee.toFixed(4)}`,
    `\n逐仓DEX计算过程：`,
    `${margin.toFixed(4)} - ${maintenanceMargin.toFixed(4)} - ${openFee.toFixed(4)} = ${(margin - maintenanceMargin - openFee).toFixed(4)}`
  ];

  return { result: (margin - maintenanceMargin - openFee).toFixed(2), steps };
};

/**
 * 计算DEX，根据仓位类型调用不同的计算方法
 */
export const calculateDEX = (pos, positions, currentBalance, contractValue) => {
  if (isPositionClosed(pos)) {
    return { result: "0.00", steps: ["该仓位已平仓，无DEX值"] };
  }

  if (pos.isMerged) {
    const mergeResult = mergePositionsBySymbol(
        [...pos.mergeInfo.originalPositions],
        contractValue
    );
    const mergeProcess = mergeResult.mergeProcesses[pos.symbol];
    const mergeSteps = ["--- 该仓位是合并仓位，先展示合并计算过程 ---", ...mergeProcess];

    const dexResult = pos.marginType === 'cross'
        ? calculateCrossDEX(pos, positions, currentBalance, contractValue)
        : calculateIsolatedDEX(pos);

    return { result: dexResult.result, steps: [...mergeSteps, "\n--- 使用合并后的仓位计算DEX ---", ...dexResult.steps] };
  }

  return pos.marginType === 'cross'
      ? calculateCrossDEX(pos, positions, currentBalance, contractValue)
      : calculateIsolatedDEX(pos);
};

/**
 * 计算所有仓位的DEX
 */
export const calculateAllDEX = (positions, currentBalance, contractValue) => {
  // 过滤有效仓位
  const activePositions = positions.filter(p => !isPositionClosed(p));

  // 分离全仓和逐仓仓位
  const crossPositions = activePositions.filter(p => p.marginType === 'cross');
  const isolatedPositions = activePositions.filter(p => p.marginType === 'isolated');

  // 创建一个结果数组
  const result = [];

  // 按交易对分组全仓仓位以确保同一交易对使用相同的DEX计算
  const crossSymbolGroups = {};
  crossPositions.forEach(pos => {
    if (!crossSymbolGroups[pos.symbol]) {
      crossSymbolGroups[pos.symbol] = [];
    }
    crossSymbolGroups[pos.symbol].push(pos);
  });

  // 计算全仓仓位的DEX
  if (crossPositions.length > 0) {
    // 计算全局数据
    const totalMaintenanceMargin = activePositions.reduce(
        (sum, p) => sum + parseFloat(p.maintenanceMargin || 0), 0);
    const totalOpenFees = activePositions.reduce(
        (sum, p) => sum + parseFloat(p.openFee || 0), 0);
    const totalIsolatedMargin = isolatedPositions.reduce(
        (sum, p) => sum + parseFloat(p.margin || 0), 0);

    // 处理每个交易对组
    Object.keys(crossSymbolGroups).forEach(symbol => {
      const positionsForSymbol = crossSymbolGroups[symbol];

      // 计算除此交易对外其他仓位的未实现盈亏
      const otherPositionsUnrealizedPnl = activePositions.reduce((sum, p) => {
        if (p.symbol !== symbol) {
          return sum + parseFloat(p.unrealizedPnl || 0);
        }
        return sum;
      }, 0);

      // 计算全仓DEX
      const crossDex = currentBalance - totalMaintenanceMargin - totalOpenFees - totalIsolatedMargin + otherPositionsUnrealizedPnl;

      // 将DEX应用到此交易对的所有全仓仓位
      positionsForSymbol.forEach(pos => {
        result.push({
          ...pos,
          dex: crossDex.toFixed(2)
        });
      });
    });
  }

  // 计算逐仓仓位的DEX
  isolatedPositions.forEach(pos => {
    // 逐仓DEX = 仓位保证金 - 仓位维持保证金 - 仓位手续费
    const isolatedDex = parseFloat(pos.margin) -
        parseFloat(pos.maintenanceMargin) -
        parseFloat(pos.openFee);

    result.push({
      ...pos,
      dex: isolatedDex.toFixed(2)
    });
  });

  // 添加已关闭的仓位（无需计算DEX）
  positions.filter(isPositionClosed).forEach(pos => {
    result.push(pos);
  });

  return result;
};

/**
 * 计算爆仓价，并返回计算过程
 */
export const calculateLiquidationPrice = (pos, contractValue) => {
  if (isPositionClosed(pos)) {
    return { result: "-", steps: ["该仓位已平仓，无爆仓价格"] };
  }

  // 使用开仓均价计算仓位价值，而不是当前价格
  const positionValue = parseFloat(pos.quantity) * contractValue * parseFloat(pos.entryPrice);
  const dex = parseFloat(pos.dex);
  let liquidationPrice;
  let steps = [];

  if (pos.direction === 'long') {
    liquidationPrice = (positionValue - dex) / (parseFloat(pos.quantity) * contractValue);
    steps = [
      `多仓爆仓价计算公式：(仓位价值 - DEX) ÷ (持仓张数 × 合约面值)`,
      `仓位价值计算：持仓张数 × 合约面值 × 开仓均价 = ${parseFloat(pos.quantity)} × ${contractValue} × ${parseFloat(pos.entryPrice)} = ${positionValue.toFixed(4)}`,
      `计算过程：(${positionValue.toFixed(4)} - ${dex.toFixed(4)}) ÷ (${parseFloat(pos.quantity)} × ${contractValue})`,
      `= ${(positionValue - dex).toFixed(4)} ÷ ${(parseFloat(pos.quantity) * contractValue).toFixed(4)}`,
      `= ${liquidationPrice.toFixed(4)}`
    ];
  } else {
    liquidationPrice = (positionValue + dex) / (parseFloat(pos.quantity) * contractValue);
    steps = [
      `空仓爆仓价计算公式：(仓位价值 + DEX) ÷ (持仓张数 × 合约面值)`,
      `仓位价值计算：持仓张数 × 合约面值 × 开仓均价 = ${parseFloat(pos.quantity)} × ${contractValue} × ${parseFloat(pos.entryPrice)} = ${positionValue.toFixed(4)}`,
      `计算过程：(${positionValue.toFixed(4)} + ${dex.toFixed(4)}) ÷ (${parseFloat(pos.quantity)} × ${contractValue})`,
      `= ${(positionValue + dex).toFixed(4)} ÷ ${(parseFloat(pos.quantity) * contractValue).toFixed(4)}`,
      `= ${liquidationPrice.toFixed(4)}`
    ];
  }

  return { result: liquidationPrice.toFixed(4), steps };
};

/**
 * 计算所有仓位的爆仓价
 */
export const calculateLiquidationPrices = (positionsWithDex, contractValue) => {
  // 按交易对分组全仓仓位
  const crossSymbolGroups = {};
  positionsWithDex.filter(p => p.marginType === 'cross' && !isPositionClosed(p)).forEach(pos => {
    if (!crossSymbolGroups[pos.symbol]) {
      crossSymbolGroups[pos.symbol] = [];
    }
    crossSymbolGroups[pos.symbol].push(pos);
  });

  // 计算每组全仓的统一爆仓价
  Object.keys(crossSymbolGroups).forEach(symbol => {
    const positions = crossSymbolGroups[symbol];
    if (positions.length === 0) return;

    // 如果是合并后的仓位，使用该仓位计算爆仓价
    const mergedPos = positions.find(p => p.isMerged);
    let liquidationPrice;

    if (mergedPos) {
      // 使用合并仓位计算爆仓价，注意使用合并后的开仓均价
      const positionValue = parseFloat(mergedPos.quantity) * contractValue * parseFloat(mergedPos.entryPrice);
      const dex = parseFloat(mergedPos.dex);

      if (mergedPos.direction === 'long') {
        liquidationPrice = (positionValue - dex) / (parseFloat(mergedPos.quantity) * contractValue);
      } else {
        liquidationPrice = (positionValue + dex) / (parseFloat(mergedPos.quantity) * contractValue);
      }

      // 将相同的爆仓价应用于所有相关仓位
      const formattedPrice = liquidationPrice.toFixed(4);
      positions.forEach(pos => {
        pos.liquidationPrice = formattedPrice;
      });
    }
    // 如果没有合并仓位但有多个仓位，需要单独合并计算
    else if (positions.length > 1) {
      // 分离多空仓位并计算总量和价值（使用开仓均价）
      let longQuantity = 0, shortQuantity = 0;
      let longValue = 0, shortValue = 0;

      positions.forEach(pos => {
        const qty = parseFloat(pos.quantity);
        const entryPrice = parseFloat(pos.entryPrice);

        if (pos.direction === 'long') {
          longQuantity += qty;
          longValue += qty * entryPrice * contractValue;
        } else {
          shortQuantity += qty;
          shortValue += qty * entryPrice * contractValue;
        }
      });

      // 计算净仓位和方向
      const netQuantity = longQuantity - shortQuantity;
      const netDirection = netQuantity > 0 ? 'long' : 'short';
      const absNetQuantity = Math.abs(netQuantity);
      const dex = parseFloat(positions[0].dex); // 所有仓位DEX相同，取第一个

      // 计算合并后的开仓均价
      let netPositionValue;
      let avgEntryPrice;

      if (netDirection === 'long') {
        // 净多仓
        netPositionValue = longValue - shortValue;
        avgEntryPrice = netPositionValue / (absNetQuantity * contractValue);
        liquidationPrice = (netPositionValue - dex) / (absNetQuantity * contractValue);
      } else {
        // 净空仓
        netPositionValue = shortValue - longValue;
        avgEntryPrice = netPositionValue / (absNetQuantity * contractValue);
        liquidationPrice = (netPositionValue + dex) / (absNetQuantity * contractValue);
      }

      // 将统一爆仓价应用于所有仓位
      const formattedPrice = liquidationPrice.toFixed(4);
      positions.forEach(pos => {
        pos.liquidationPrice = formattedPrice;
      });
    }
    // 只有一个仓位的情况
    else {
      const pos = positions[0];
      const positionValue = parseFloat(pos.quantity) * contractValue * parseFloat(pos.entryPrice);
      const dex = parseFloat(pos.dex);

      if (pos.direction === 'long') {
        liquidationPrice = (positionValue - dex) / (parseFloat(pos.quantity) * contractValue);
      } else {
        liquidationPrice = (positionValue + dex) / (parseFloat(pos.quantity) * contractValue);
      }

      pos.liquidationPrice = liquidationPrice.toFixed(4);
    }
  });

  // 处理逐仓仓位的爆仓价
  positionsWithDex.filter(p => p.marginType === 'isolated' && !isPositionClosed(p)).forEach(pos => {
    const positionValue = parseFloat(pos.quantity) * contractValue * parseFloat(pos.entryPrice);
    const dex = parseFloat(pos.dex);
    let liquidationPrice;

    if (pos.direction === 'long') {
      liquidationPrice = (positionValue - dex) / (parseFloat(pos.quantity) * contractValue);
    } else {
      liquidationPrice = (positionValue + dex) / (parseFloat(pos.quantity) * contractValue);
    }

    pos.liquidationPrice = liquidationPrice.toFixed(4);
  });

  return positionsWithDex;
};
/**
 * 重新计算所有仓位的值
 */
export const recalculateAllPositions = (props) => {
  const {
    positions, currentPrice, contractValue, feeRate,
    maintenanceMarginRate, currentBalance, addToLog,
    currentUser, currentDateTime, isAutoRefresh = false
  } = props;

  const steps = [];

  if (!isAutoRefresh) {
    steps.push(`--- 重新计算所有仓位 ---`);
    steps.push(`用户: ${currentUser || "z"}`); // 使用提供的用户或默认值
    steps.push(`时间: ${currentDateTime || "2025-05-19 03:22:19"}`); // 使用提供的时间或默认值
  }

  // 重新计算所有仓位的基础值
  let updatedPositions = positions.map(pos => {
    if (isPositionClosed(pos)) return pos;

    return calculatePositionValues(
        pos, currentPrice, contractValue, feeRate, maintenanceMarginRate
    );
  });

  // 计算所有仓位的DEX
  if (!isAutoRefresh) {
    steps.push(`--- 更新所有仓位DEX ---`);

    // 在计算前显示合并计算过程
    const crossPositions = updatedPositions.filter(p => p.marginType === 'cross' && !isPositionClosed(p));
    const crossSymbols = [...new Set(crossPositions.map(p => p.symbol))];

    // 对每个有多个全仓仓位的交易对显示合并计算过程
    crossSymbols.forEach(symbol => {
      const positionsForSymbol = crossPositions.filter(p => p.symbol === symbol);
      if (positionsForSymbol.length > 1) {
        const mergeResult = mergePositionsBySymbol(positionsForSymbol, contractValue);
        if (mergeResult.mergeProcesses && mergeResult.mergeProcesses[symbol]) {
          steps.push(...mergeResult.mergeProcesses[symbol]);
        }
      }
    });
  }

  const positionsWithDex = calculateAllDEX(updatedPositions, currentBalance, contractValue);

  // 基于更新的DEX计算爆仓价
  if (!isAutoRefresh) {
    steps.push(`--- 计算爆仓价格 ---`);
  }

  const finalPositions = calculateLiquidationPrices(positionsWithDex, contractValue);

  // 显示每个仓位的DEX和爆仓价更新
  if (!isAutoRefresh) {
    // 对于合并后的仓位也要显示DEX和爆仓价
    finalPositions.filter(p => !isPositionClosed(p)).forEach(pos => {
      // 使用开仓均价计算仓位价值，而非当前价格
      const positionValue = parseFloat(pos.quantity) * contractValue * parseFloat(pos.entryPrice);

      // 如果是合并仓位特殊标记
      steps.push(`\n仓位: ${pos.symbol} ${translateDirection(pos.direction)} ${pos.quantity}张 ${pos.isMerged ? "(合并仓位)" : ""}:`);
      steps.push(`  开仓均价: ${pos.entryPrice}`);
      steps.push(`  DEX: ${pos.dex}`);

      if (pos.direction === 'long') {
        steps.push(`  多仓爆仓价计算: (${positionValue.toFixed(4)} - ${pos.dex}) ÷ (${pos.quantity} × ${contractValue}) = ${pos.liquidationPrice}`);
      } else {
        steps.push(`  空仓爆仓价计算: (${positionValue.toFixed(4)} + ${pos.dex}) ÷ (${pos.quantity} × ${contractValue}) = ${pos.liquidationPrice}`);
      }
    });
  }

  // 将计算步骤添加到日志
  if (steps.length > 0 && addToLog) {
    steps.forEach(step => addToLog(step));
  }

  return finalPositions;
};
/**
 * 生成账户指标计算步骤
 */
function generateAccountMetricsSteps(
    positions, initialBalance, currentBalance,
    totalMarginCross, totalMarginIsolated, totalMargin,
    totalOpenFee, totalCloseFee, totalFee,
    totalUnrealizedPnl, totalRealizedPnl, availableBalance,
    transferableBalance,
    availableBalanceSteps,
    transferableSteps
) {
  const steps = [];

  const activePositions = positions.filter(p => !isPositionClosed(p));
  const closedPositions = positions.filter(p => isPositionClosed(p));

  steps.push(`初始余额: ${initialBalance.toFixed(2)}`);
  steps.push(`当前余额: ${currentBalance.toFixed(2)}`);

  steps.push(`全仓仓位数: ${activePositions.filter(p => p.marginType === 'cross').length}`);
  steps.push(`逐仓仓位数: ${activePositions.filter(p => p.marginType === 'isolated').length}`);

  // 全仓保证金详细计算
  if (activePositions.filter(p => p.marginType === 'cross').length > 0) {
    steps.push(`全仓保证金计算公式：仓位1保证金 + 仓位2保证金 + ... + 仓位n保证金`);
    const crossMarginDetails = activePositions
        .filter(p => p.marginType === 'cross')
        .map(p => `${p.symbol} ${translateDirection(p.direction)} ${p.quantity}张: ${p.margin}`);
    steps.push(`全仓保证金明细: ${crossMarginDetails.join(', ')}`);
    steps.push(`计算过程：${activePositions.filter(p => p.marginType === 'cross').map(p => p.margin).join(' + ')} = ${totalMarginCross.toFixed(2)}`);
  } else {
    steps.push(`全仓保证金: 0`);
  }

  // 逐仓保证金详细计算
  if (activePositions.filter(p => p.marginType === 'isolated').length > 0) {
    steps.push(`逐仓保证金计算公式：仓位1保证金 + 仓位2保证金 + ... + 仓位n保证金`);
    const isolatedMarginDetails = activePositions
        .filter(p => p.marginType === 'isolated')
        .map(p => `${p.symbol} ${translateDirection(p.direction)} ${p.quantity}张: ${p.margin}`);
    steps.push(`逐仓保证金明细: ${isolatedMarginDetails.join(', ')}`);
    steps.push(`计算过程：${activePositions.filter(p => p.marginType === 'isolated').map(p => p.margin).join(' + ')} = ${totalMarginIsolated.toFixed(2)}`);
  } else {
    steps.push(`逐仓保证金: 0`);
  }

  // 开仓手续费详细计算
  if (activePositions.length > 0) {
    steps.push(`开仓手续费总和计算公式：仓位1开仓手续费 + 仓位2开仓手续费 + ... + 仓位n开仓手续费`);
    const openFeeDetails = activePositions.map(p => `${p.symbol} ${translateDirection(p.direction)} ${p.quantity}张: ${p.openFee}`);
    steps.push(`开仓手续费明细: ${openFeeDetails.join(', ')}`);
    steps.push(`计算过程：${activePositions.map(p => p.openFee).join(' + ')} = ${totalOpenFee.toFixed(4)}`);

    // 未实现盈亏详细计算
    steps.push(`未实现盈亏总和计算公式：仓位1未实现盈亏 + 仓位2未实现盈亏 + ... + 仓位n未实现盈亏`);
    const unrealizedPnlDetails = activePositions.map(p => `${p.symbol} ${translateDirection(p.direction)} ${p.quantity}张: ${p.unrealizedPnl}`);
    steps.push(`未实现盈亏明细: ${unrealizedPnlDetails.join(', ')}`);
    steps.push(`计算过程：${activePositions.map(p => p.unrealizedPnl).join(' + ')} = ${totalUnrealizedPnl.toFixed(2)}`);
  } else {
    steps.push(`开仓手续费总和: 0`);
    steps.push(`未实现盈亏总和: 0`);
  }

  // 平仓手续费和已实现盈亏详细计算
  if (closedPositions.length > 0) {
    steps.push(`平仓手续费总和计算公式：仓位1平仓手续费 + 仓位2平仓手续费 + ... + 仓位n平仓手续费`);
    const closeFeeDetails = closedPositions.map(p => `${p.symbol} ${translateDirection(p.direction)} ${p.quantity}张: ${p.closeFee}`);
    steps.push(`平仓手续费明细: ${closeFeeDetails.join(', ')}`);
    steps.push(`计算过程：${closedPositions.map(p => p.closeFee).join(' + ')} = ${totalCloseFee.toFixed(4)}`);

    steps.push(`总手续费计算公式：开仓手续费总和 + 平仓手续费总和`);
    steps.push(`计算过程：${totalOpenFee.toFixed(4)} + ${totalCloseFee.toFixed(4)} = ${totalFee.toFixed(4)}`);

    steps.push(`已实现盈亏总和计算公式：仓位1已实现盈亏 + 仓位2已实现盈亏 + ... + 仓位n已实现盈亏`);
    const realizedPnlDetails = closedPositions.map(p => `${p.symbol} ${translateDirection(p.direction)} ${p.quantity}张: ${p.realizedPnl}`);
    steps.push(`已实现盈亏明细: ${realizedPnlDetails.join(', ')}`);
    steps.push(`计算过程：${closedPositions.map(p => p.realizedPnl).join(' + ')} = ${totalRealizedPnl.toFixed(2)}`);
  } else {
    steps.push(`平仓手续费总和: 0`);
    steps.push(`总手续费: ${totalOpenFee.toFixed(4)}`);
    steps.push(`已实现盈亏总和: 0`);
  }

  // 添加可用余额和可划转金额的计算步骤
  steps.push(`\n--- 可用余额计算 ---`);
  if (availableBalanceSteps) {
    steps.push(...availableBalanceSteps);
  }

  steps.push(`\n--- 可划转金额计算 ---`);
  if (transferableSteps) {
    steps.push(...transferableSteps);
  }

  return steps;
}
/**
 * 计算账户信息
 */
export const calculateAccountInfo = (positions, initialBalance, currentBalance) => {
  const totalMarginCross = positions
      .filter(p => p.marginType === 'cross' && !isPositionClosed(p))
      .reduce((sum, p) => sum + parseFloat(p.margin || 0), 0);

  const totalMarginIsolated = positions
      .filter(p => p.marginType === 'isolated' && !isPositionClosed(p))
      .reduce((sum, p) => sum + parseFloat(p.margin || 0), 0);

  const totalMargin = totalMarginCross + totalMarginIsolated;

  const totalOpenFee = positions
      .reduce((sum, p) => sum + parseFloat(p.openFee || 0), 0);

  const totalCloseFee = positions
      .filter(p => isPositionClosed(p) && p.closeFee)
      .reduce((sum, p) => sum + parseFloat(p.closeFee || 0), 0);

  const totalFee = totalOpenFee + totalCloseFee;

  const totalUnrealizedPnl = positions
      .filter(p => !isPositionClosed(p))
      .reduce((sum, p) => sum + parseFloat(p.unrealizedPnl || 0), 0);

  const totalRealizedPnl = positions
      .filter(p => isPositionClosed(p) && p.realizedPnl)
      .reduce((sum, p) => sum + parseFloat(p.realizedPnl || 0), 0);

  // 计算可用余额 - 包括全部的全仓未实现盈亏
  const {
    availableBalance,
    availableBalanceFormatted,
    steps: availableBalanceSteps,
    totalCrossPnl
  } = calculateAvailableBalance(positions, currentBalance);

  // 计算可划转金额 - 只包括全仓亏损部分
  const {
    transferableBalance,
    transferableBalanceFormatted,
    steps: transferableSteps,
    totalCrossLoss
  } = calculateTransferableBalance(positions, currentBalance);

  // 生成账户指标计算步骤
  const steps = generateAccountMetricsSteps(
      positions, initialBalance, currentBalance,
      totalMarginCross, totalMarginIsolated, totalMargin,
      totalOpenFee, totalCloseFee, totalFee,
      totalUnrealizedPnl, totalRealizedPnl,
      availableBalance, transferableBalance,
      availableBalanceSteps, transferableSteps
  );

  return {
    totalMarginCross: Number(totalMarginCross.toFixed(4)),
    totalMarginIsolated: Number(totalMarginIsolated.toFixed(4)),
    totalMargin: Number(totalMargin.toFixed(4)),
    totalOpenFee,
    totalCloseFee,
    totalFee,
    totalUnrealizedPnl: Number(totalUnrealizedPnl.toFixed(4)),
    totalRealizedPnl: Number(totalRealizedPnl.toFixed(4)),
    availableBalance: Number(availableBalance.toFixed(4)),

    availableBalanceFormatted,        // 可用余额（格式化）
    transferableBalance: Number(transferableBalance.toFixed(4)),              // 可划转余额（数值）
    transferableBalanceFormatted,     // 可划转余额（格式化）
    totalCrossPnl,                    // 全仓仓位全部未实现盈亏
    totalCrossLoss,                   // 全仓仓位亏损部分
    totalIsolatedMargin: totalMarginIsolated,
    totalCrossMargin: totalMarginCross,
    steps
  };
};

