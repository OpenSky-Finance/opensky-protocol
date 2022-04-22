// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

library Errors {
    
    // math
    string public constant MATH_MULTIPLICATION_OVERFLOW = '1';
    string public constant MATH_ADDITION_OVERFLOW = '2';
    string public constant MATH_DIVISION_BY_ZERO = '3';

    // settings/acl
    string public constant ACL_ONLY_ADDRESS_ADMIN_CAN_CALL = '4';
    string public constant ACL_ONLY_GOVERNANCE_CAN_CALL = '5';
    string public constant ACL_ONLY_EMERGENCY_ADMIN_CAN_CALL = '6';
    string public constant ACL_ONLY_POOL_ADMIN_CAN_CALL = '7';
    string public constant ACL_ONLY_LIQUIDATOR_CAN_CALL = '8';
    string public constant ACL_ONLY_LIQUIDATION_OPERATOR_CAN_CALL = '9';
    string public constant ACL_ONLY_AIRDROP_OPERATOR_CAN_CALL = '10';
    string public constant ACL_ONLY_POOL_CAN_CALL = '11';

    
    //deposit
    string public constant DEPOSIT_AMOUNT_SHOULD_BE_BIGGER_THAN_ZERO = '12';

    // withdraw
    string public constant WITHDRAW_AMOUNT_NOT_ALLOWED = '13';
    string public constant WITHDRAW_LIQUIDITY_NOT_SUFFIENCE = '14';

    // borrow
    string public constant BORROW_DURATION_NOT_ALLOWED = '15';
    string public constant BORROW_AMOUNT_EXCEED_BORROW_LIMIT = '16';

    // repay
    string public constant REPAY_STATUS_ERROR = '17';
    string public constant REPAY_AMOUNT_NOT_ENOUGH = '18';

    // extend
    string public constant EXTEND_STATUS_ERROR = '19';
    string public constant EXTEND_MSG_VALUE_ERROR = '20';

    // liquidate
    string public constant START_LIQUIDATION_STATUS_ERROR = '21';
    string public constant END_LIQUIDATION_STATUS_ERROR = '22';
    string public constant END_LIQUIDATION_AMOUNT_ERROR = '23';

    // loan
    string public constant LOAN_SET_STATUS_ERROR = '24';
    string public constant LOAN_REPAYER_IS_NOT_OWNER = '25';
    string public constant LOAN_LIQUIDATING_STATUS_CAN_NOT_BE_UPDATED = '26';
    string public constant LOAN_CALLER_IS_NOT_OWNER = '27';
    string public constant LOAN_IS_END = '28';
    string public constant FLASHLOAN_EXECUTOR_ERROR = '29';
    string public constant FLASHLOAN_STATUS_ERROR = '30';

    // money market
    string public constant MONEY_MARKET_DEPOSIT_AMOUNT_ALLOWED = '31';
    string public constant MONEY_MARKET_WITHDRAW_AMOUNT_NOT_ALLOWED = '32';
    string public constant MONEY_MARKET_APPROVAL_FAILED = '33';
    string public constant MONEY_MARKET_DELEGATE_CALL_ERROR = '34';

    // price oracle
    string public constant PRICE_ORACLE_ROUND_INTERVAL_CAN_NOT_BE_0 = '35';
    string public constant PRICE_ORACLE_HAS_NO_PRICE_FEED = '36';
    string public constant PRICE_ORACLE_INCORRECT_TIMESTAMP = '37';
    string public constant PRICE_ORACLE_PARAMS_ERROR = '38';

    // reserve
    string public constant RESERVE_LIQUIDITY_INSUFFICIENT = '39';
    string public constant RESERVE_DOES_NOT_EXISTS = '40';
    string public constant RESERVE_INDEX_OVERFLOW = '41';

    // token
    string public constant AMOUNT_SCALED_IS_ZERO = '42';
    string public constant AMOUNT_TRANSFER_OWERFLOW = '43';


    string public constant ETH_TRANSFER_FAILED = '44';
    string public constant RECEIVE_NOT_ALLOWED = '45';
    string public constant FALLBACK_NOT_ALLOWED = '46';
}
