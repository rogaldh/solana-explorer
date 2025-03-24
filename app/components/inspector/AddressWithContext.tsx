import { Address } from '@components/common/Address';
import { Account, useAccountInfo, useAddressLookupTable, useFetchAccountInfo } from '@providers/accounts';
import { useCluster } from '@providers/cluster';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { ClusterStatus } from '@utils/cluster';
import { lamportsToSolString } from '@utils/index';
import { addressLabel } from '@utils/tx';
import React from 'react';

type AccountValidator = (account: Account) => string | undefined;

export const createFeePayerValidator = (feeLamports: number): AccountValidator => {
    return (account: Account): string | undefined => {
        if (account.lamports === 0) return "Account doesn't exist";
        if (!account.owner.equals(SystemProgram.programId)) return 'Only system-owned accounts can pay fees';
        if (account.lamports < feeLamports) {
            return 'Insufficient funds for fees';
        }
        return;
    };
};

export const programValidator = (account: Account): string | undefined => {
    if (account.lamports === 0) return "Account doesn't exist";
    if (!account.executable) return 'Only executable accounts can be invoked';
    return;
};

export function AddressFromLookupTableWithContext({
    lookupTableKey,
    lookupTableIndex,
    hideInfo = false,
}: {
    lookupTableKey: PublicKey;
    lookupTableIndex: number;
    hideInfo?: boolean;
}) {
    const lookupTableInfo = useAddressLookupTable(lookupTableKey.toBase58());
    const lookupTable = lookupTableInfo && lookupTableInfo[0];
    if (!lookupTable) {
        return (
            <span className="text-muted">
                <span className="spinner-grow spinner-grow-sm me-2"></span>
                Loading
            </span>
        );
    } else if (typeof lookupTable === 'string') {
        return <div>Invalid Lookup Table</div>;
    } else if (lookupTableIndex >= lookupTable.state.addresses.length) {
        return <div>Invalid Lookup Table Index</div>;
    } else {
        const pubkey = lookupTable.state.addresses[lookupTableIndex];
        return (
            <div className="d-flex align-items-lg-end flex-column">
                <Address pubkey={pubkey} link />
                {hideInfo ? null : <AccountInfo pubkey={pubkey} />}
            </div>
        );
    }
}

export function AddressWithContext({
    pubkey,
    validator,
    hideInfo = false,
}: {
    pubkey: PublicKey;
    validator?: AccountValidator;
    hideInfo?: boolean;
}) {
    return (
        <div className="d-flex align-items-lg-end flex-column">
            <Address pubkey={pubkey} link />
            {hideInfo ? null : <AccountInfo pubkey={pubkey} validator={validator} />}
        </div>
    );
}

function AccountInfo({ pubkey, validator }: { pubkey: PublicKey; validator?: AccountValidator }) {
    const address = pubkey.toBase58();
    const fetchAccount = useFetchAccountInfo();
    const info = useAccountInfo(address);
    const { cluster, status } = useCluster();

    // Fetch account on load
    React.useEffect(() => {
        if (!info && status === ClusterStatus.Connected && pubkey) {
            // That is needed to fetch acccount data properly.
            // The issue is that at the inspector page
            //  instructions start to request data for different addresses.
            //  Having "skip" here causes cases flaky situation when account data is fetched but erased after.
            fetchAccount(pubkey, 'parsed');
        }
    }, [address, status]); // eslint-disable-line react-hooks/exhaustive-deps

    const account = info?.data;
    if (!account)
        return (
            <span className="text-muted">
                <span className="spinner-grow spinner-grow-sm me-2"></span>
                Loading
            </span>
        );

    const errorMessage = validator && validator(account);
    if (errorMessage) return <span className="text-warning">{errorMessage}</span>;

    if (account.lamports === 0) {
        return <span className="text-muted">Account doesn&apos;t exist</span>;
    }

    const ownerAddress = account.owner.toBase58();
    const ownerLabel = addressLabel(ownerAddress, cluster);

    return (
        <span className="text-muted">
            {`Owned by ${ownerLabel || ownerAddress}.`}
            {` Balance is ${lamportsToSolString(account.lamports)} SOL.`}
            {account.space !== undefined && ` Size is ${new Intl.NumberFormat('en-US').format(account.space)} byte(s).`}
        </span>
    );
}
