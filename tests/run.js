(async () => {
  try {
    await require("./walletService.test")();
    await require("./pricingService.test")();
    await require("./apiTransactionService.test")();
    await require("./userPricingService.test")();
    console.log("\nALL TESTS PASSED");
    process.exit(0);
  } catch (error) {
    console.error("\nTEST FAILURE:", error);
    process.exit(1);
  }
})();
