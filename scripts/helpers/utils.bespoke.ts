import { defaultAbiCoder, keccak256, parseEther, solidityPack } from 'ethers/lib/utils';
import { TypedDataDomain } from '@ethersproject/abstract-signer';
import { _TypedDataEncoder } from '@ethersproject/hash';
import _ from 'lodash';
import { constants } from 'ethers';

export function signOffer(offerData: any, signer: any) {
    const types = [
        'bytes32',
        'bool', // isProrated;
        'bool', //autoConvertWhenRepay
        'uint8', //offerType

        'address', //tokenAddress
        'uint256', //tokenId
        'uint256', //tokenAmount
        'address', //signer
        'uint256', //borrowAmountMin
        'uint256', //borrowAmountMax
        'uint256', //borrowDuration
        'uint256', //borrowDurationMax
        'uint256', //borrowRate
        'address', //currency
        'address', //lendAsset

        'uint256', //nonce
        'uint256', //nonceMaxTimes
        'uint256', //deadline
        'address', //strategy
        'bytes32', //params
    ];

    const values = [
        '0x5898afb02f4982fe09fa9b4daac8eb8efd917a7c9412c0671717c798ae97aa99',
        offerData.isProrated,
        offerData.autoConvertWhenRepay,
        offerData.offerType,

        offerData.tokenAddress,
        offerData.tokenId,
        offerData.tokenAmount,
        offerData.signer,
        offerData.borrowAmountMin,
        offerData.borrowAmountMax,
        offerData.borrowDurationMin,
        offerData.borrowDurationMax,
        offerData.borrowRate,
        offerData.currency,
        offerData.lendAsset,

        offerData.nonce,
        offerData.nonceMaxTimes,
        offerData.deadline,
        offerData.strategy,
        keccak256(offerData.params),
    ];

    const domain: TypedDataDomain = {
        name: 'OpenSkyBespokeMarket',
        version: '1',
        chainId: '31337', // HRE
        verifyingContract: offerData.verifyingContract,
    };
    const domainSeparator = _TypedDataEncoder.hashDomain(domain);
    const hash = keccak256(defaultAbiCoder.encode(types, values));

    // Compute the digest
    const digest = keccak256(
        solidityPack(['bytes1', 'bytes1', 'bytes32', 'bytes32'], ['0x19', '0x01', domainSeparator, hash])
    );

    return { ...signer._signingKey().signDigest(digest) };
}

export function createOfferData(ENV: any, overwrites: any, signerWallet: any) {
    const { OpenSkyBespokeMarket, OpenSkyNFT, WNative } = ENV;

    const BORROW_AMOUNT = parseEther('1');
    const BORROW_DURATION = 24 * 3600 * 7;

    const templateOfferData = {
        autoConvertWhenRepay: true,
        isProrated: false,
        offerType: 0,

        tokenAddress: OpenSkyNFT.address,
        tokenId: 1,
        tokenAmount: 1,
        borrowAmountMin: BORROW_AMOUNT,
        borrowAmountMax: BORROW_AMOUNT.add(parseEther('1')),
        borrowDurationMin: BORROW_DURATION,
        borrowDurationMax: BORROW_DURATION + 24 * 3600 * 30,
        borrowRate: 2000, // 20%
        currency: WNative.address,
        lendAsset: WNative.address,
        signer: signerWallet.address,
        //
        nonce: constants.One,
        nonceMaxTimes: constants.One,
        deadline: parseInt(Date.now() / 1000 + '') + 24 * 3600 * 7,

        strategy: constants.AddressZero,
        params: defaultAbiCoder.encode([], []),
        // for TypedDataDomain
        verifyingContract: OpenSkyBespokeMarket.address,
    };

    let offerData = {
        ..._.cloneDeep(templateOfferData),
        ...(overwrites || {}),
        signer: signerWallet.address,
    };

    offerData = {
        ...offerData,
        ...signOffer(offerData, signerWallet),
    };
    return offerData;
}

export function encodeOfferData(offerData: any) {
    const types = [
        'bool', // isProrated;
        'bool', //autoInvestWhenRepay
        'uint8', //offerType

        'address', //tokenAddress
        'uint256', //tokenId
        'uint256', //tokenAmount
        'address', //signer
        'uint256', //borrowAmountMin
        'uint256', //borrowAmountMax
        'uint256', //borrowDuration
        'uint256', //borrowDurationMax
        'uint256', //borrowRate
        'address', //currency
        'address', //lendAsset

        'uint256', //nonce
        'uint256', //nonceMaxTimes
        'uint256', //deadline
        'address', //strategy
        'bytes', //params // notice: not bytes32
        'uint8',
        'bytes32',
        'bytes32',
    ];

    const values = [
        offerData.isProrated,
        offerData.autoConvertWhenRepay,
        offerData.offerType,

        offerData.tokenAddress,
        offerData.tokenId,
        offerData.tokenAmount,
        offerData.signer,
        offerData.borrowAmountMin,
        offerData.borrowAmountMax,
        offerData.borrowDurationMin,
        offerData.borrowDurationMax,
        offerData.borrowRate,
        offerData.currency,
        offerData.lendAsset,

        offerData.nonce,
        offerData.nonceMaxTimes,
        offerData.deadline,
        offerData.strategy,
        offerData.params,

        offerData.v,
        offerData.r,
        offerData.s,
    ];

    return defaultAbiCoder.encode(types, values);
}
