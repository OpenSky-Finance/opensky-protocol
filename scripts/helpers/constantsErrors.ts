export const Errors = {
    // common
    MATH_MULTIPLICATION_OVERFLOW: '100',
    MATH_ADDITION_OVERFLOW: '101',
    MATH_DIVISION_BY_ZERO: '102',

    ETH_TRANSFER_FAILED: '110',
    RECEIVE_NOT_ALLOWED: '111',
    FALLBACK_NOT_ALLOWED: '112',

    SETTING_WHITELIST_INVALID_RESERVE_ID:"117",
    SETTING_WHITELIST_NFT_ADDRESS_IS_ZERO:"118",
    SETTING_WHITELIST_NFT_DURATION_OUT_OF_ORDER:'119',
    SETTING_WHITELIST_NFT_NAME_EMPTY: '120',
    SETTING_WHITELIST_NFT_SYMBOL_EMPTY:'121',
    SETTING_WHITELIST_NFT_LTV_NOT_ALLOWED:"122",

    // settings/acl
    ACL_ONLY_GOVERNANCE_CAN_CALL: '200',
    ACL_ONLY_EMERGENCY_ADMIN_CAN_CALL: '201',
    ACL_ONLY_POOL_ADMIN_CAN_CALL: '202',
    ACL_ONLY_LIQUIDATOR_CAN_CALL: '203',
    ACL_ONLY_AIRDROP_OPERATOR_CAN_CALL: '204',
    ACL_ONLY_POOL_CAN_CALL: '205',

    // lending & borrowing 
    // reserve
    RESERVE_DOES_NOT_EXIST: '300',
    RESERVE_LIQUIDITY_INSUFFICIENT: '301',
    RESERVE_INDEX_OVERFLOW: '302',
    RESERVE_SWITCH_MONEY_MARKET_STATE_ERROR: '303',

    // token
    AMOUNT_SCALED_IS_ZERO: '310',
    AMOUNT_TRANSFER_OVERFLOW: '311',
    
    //deposit
    DEPOSIT_AMOUNT_SHOULD_BE_BIGGER_THAN_ZERO: '320',

    // withdraw
    WITHDRAW_AMOUNT_NOT_ALLOWED: '321',
    WITHDRAW_LIQUIDITY_NOT_SUFFICIENT: '322',

    // borrow
    BORROW_DURATION_NOT_ALLOWED: '330',
    BORROW_AMOUNT_EXCEED_BORROW_LIMIT: '331',
    NFT_ADDRESS_IS_NOT_IN_WHITELIST: '332',

    // repay
    REPAY_STATUS_ERROR: '333',
    REPAY_AMOUNT_NOT_ENOUGH: '334',

    // extend
    EXTEND_STATUS_ERROR: '335',
    EXTEND_MSG_VALUE_ERROR: '336',

    // liquidate
    START_LIQUIDATION_STATUS_ERROR: '360',
    END_LIQUIDATION_STATUS_ERROR: '361',
    END_LIQUIDATION_AMOUNT_ERROR: '362',

    // loan
    LOAN_DOES_NOT_EXIST: '400',
    LOAN_SET_STATUS_ERROR: '401',
    LOAN_REPAYER_IS_NOT_OWNER: '402',
    LOAN_LIQUIDATING_STATUS_CAN_NOT_BE_UPDATED: '403',
    LOAN_CALLER_IS_NOT_OWNER: '404',
    LOAN_COLLATERAL_NFT_CAN_NOT_BE_CLAIMED: '405',

    FLASHLOAN_EXECUTOR_ERROR: '410',
    FLASHLOAN_STATUS_ERROR: '411',

    // money market
    MONEY_MARKET_DEPOSIT_AMOUNT_NOT_ALLOWED: '500',
    MONEY_MARKET_WITHDRAW_AMOUNT_NOT_ALLOWED: '501',
    MONEY_MARKET_APPROVAL_FAILED: '502',
    MONEY_MARKET_DELEGATE_CALL_ERROR: '503',

    // price oracle
    PRICE_ORACLE_HAS_NO_PRICE_FEED: '600',
    PRICE_ORACLE_INCORRECT_TIMESTAMP: '601',
    PRICE_ORACLE_PARAMS_ERROR: '602',
};
