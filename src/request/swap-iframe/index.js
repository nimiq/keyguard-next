/* global runKeyguard */
/* global SwapIFrameApi */

runKeyguard(SwapIFrameApi, {
    loadNimiq: false,
    whitelist: [
        'signSwapTransactions',
    ],
});
