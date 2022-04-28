const { BigNumber: BN } = require('@ethersproject/bignumber');

function almostEqualAssertion(this: any, expected: any, actual: any, message: string): any {
    this.assert(
        expected.add(BN.from(1)).eq(actual) ||
            expected.add(BN.from(2)).eq(actual) ||
            actual.add(BN.from(1)).eq(expected) ||
            actual.add(BN.from(2)).eq(expected) ||
            expected.eq(actual),
        `${message} expected #{act} to be almost equal #{exp}`,
        `${message} expected #{act} to be different from #{exp}`,
        expected.toString(),
        actual.toString()
    );
}

export function chaiAlmostEqual() {
    return function (chai: any, utils: any) {
        chai.Assertion.overwriteMethod('almostEqual', function (original: any) {
            return function (this: any, value: any, message: string) {
                var expected = BN.from(value);
                var actual = BN.from(this._obj);
                almostEqualAssertion.apply(this, [expected, actual, message]);
            };
        });
    };
}
