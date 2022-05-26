// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

library Errors {
    
    // common
    string public constant MATH_MULTIPLICATION_OVERFLOW = '100';
    string public constant MATH_ADDITION_OVERFLOW = '101';
    string public constant MATH_DIVISION_BY_ZERO = '102';

    string public constant ETH_TRANSFER_FAILED = '110';
    string public constant RECEIVE_NOT_ALLOWED = '111';
    string public constant FALLBACK_NOT_ALLOWED = '112';

    // settings/acl
    string public constant ACL_ONLY_GOVERNANCE_CAN_CALL = '200';
    string public constant ACL_ONLY_EMERGENCY_ADMIN_CAN_CALL = '201';
    string public constant ACL_ONLY_POOL_ADMIN_CAN_CALL = '202';
    string public constant ACL_ONLY_LIQUIDATOR_CAN_CALL = '203';
    string public constant ACL_ONLY_LIQUIDATION_OPERATOR_CAN_CALL = '204';
    string public constant ACL_ONLY_AIRDROP_OPERATOR_CAN_CALL = '205';
    string public constant ACL_ONLY_POOL_CAN_CALL = '206';

    // lending & borrowing 
    // reserve
    string public constant RESERVE_DOES_NOT_EXIST = '300';
    string public constant RESERVE_LIQUIDITY_INSUFFICIENT = '301';
    string public constant RESERVE_INDEX_OVERFLOW = '302';

    // token
    string public constant AMOUNT_SCALED_IS_ZERO = '310';
    string public constant AMOUNT_TRANSFER_OWERFLOW = '311';
    
    //deposit
    string public constant DEPOSIT_AMOUNT_SHOULD_BE_BIGGER_THAN_ZERO = '320';

    // withdraw
    string public constant WITHDRAW_AMOUNT_NOT_ALLOWED = '321';
    string public constant WITHDRAW_LIQUIDITY_NOT_SUFFIENCE = '322';

    // borrow
    string public constant BORROW_DURATION_NOT_ALLOWED = '330';
    string public constant BORROW_AMOUNT_EXCEED_BORROW_LIMIT = '331';
    string public constant NFT_ADDRESS_IS_NOT_IN_WHITELIST = '332';

    // repay
    string public constant REPAY_STATUS_ERROR = '333';
    string public constant REPAY_AMOUNT_NOT_ENOUGH = '334';

    // extend
    string public constant EXTEND_STATUS_ERROR = '335';
    string public constant EXTEND_MSG_VALUE_ERROR = '336';

    // liquidate
    string public constant START_LIQUIDATION_STATUS_ERROR = '360';
    string public constant END_LIQUIDATION_STATUS_ERROR = '361';
    string public constant END_LIQUIDATION_AMOUNT_ERROR = '362';

    // loan
    string public constant LOAN_DOES_NOT_EXIST = '400';
    string public constant LOAN_SET_STATUS_ERROR = '401';
    string public constant LOAN_REPAYER_IS_NOT_OWNER = '402';
    string public constant LOAN_LIQUIDATING_STATUS_CAN_NOT_BE_UPDATED = '403';
    string public constant LOAN_CALLER_IS_NOT_OWNER = '404';
    string public constant LOAN_COLLATERAL_NFT_CAN_NOT_BE_CLAIMED = '405';

    string public constant FLASH_CLAIM_EXECUTOR_ERROR = '410';
    string public constant FLASH_CLAIM_STATUS_ERROR = '411';

    // money market
    string public constant MONEY_MARKET_DEPOSIT_AMOUNT_ALLOWED = '500';
    string public constant MONEY_MARKET_WITHDRAW_AMOUNT_NOT_ALLOWED = '501';
    string public constant MONEY_MARKET_APPROVAL_FAILED = '502';
    string public constant MONEY_MARKET_DELEGATE_CALL_ERROR = '503';

    // price oracle
    string public constant PRICE_ORACLE_ROUND_INTERVAL_CAN_NOT_BE_0 = '600';
    string public constant PRICE_ORACLE_HAS_NO_PRICE_FEED = '601';
    string public constant PRICE_ORACLE_INCORRECT_TIMESTAMP = '602';
    string public constant PRICE_ORACLE_PARAMS_ERROR = '603';
}
