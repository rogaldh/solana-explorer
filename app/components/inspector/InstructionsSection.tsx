import { BaseInstructionCard } from '@components/common/BaseInstructionCard';
import { useCluster } from '@providers/cluster';
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { ComputeBudgetProgram, MessageCompiledInstruction, SystemProgram, VersionedMessage } from '@solana/web3.js';
import { getProgramName } from '@utils/tx';
import React from 'react';
import { ErrorBoundary } from 'react-error-boundary';

import { useAnchorProgram } from '@/app/providers/anchor';

import AnchorDetailsCard from '../instruction/AnchorDetailsCard';
import { ComputeBudgetDetailsCard } from '../instruction/ComputeBudgetDetailsCard';
import { SystemDetailsCard } from '../instruction/system/SystemDetailsCard';
import { AssociatedTokenDetailsCard } from './associated-token/AssociatedTokenDetailsCard';
import { intoParsedInstruction } from './into-parsed-data';
import { UnknownDetailsCard } from './UnknownDetailsCard';
import { intoTransactionInstructionFromVersionedMessage } from './utils';

export function InstructionsSection({ message }: { message: VersionedMessage }) {
    return (
        <>
            {message.compiledInstructions.map((ix, index) => {
                return <InspectorInstructionCard key={index} {...{ index, ix, message }} />;
            })}
        </>
    );
}

function InspectorInstructionCard({
    message,
    ix,
    index,
}: {
    message: VersionedMessage;
    ix: MessageCompiledInstruction;
    index: number;
}) {
    const { cluster, url } = useCluster();
    const programId = message.staticAccountKeys[ix.programIdIndex];
    const programName = getProgramName(programId.toBase58(), cluster);
    const anchorProgram = useAnchorProgram(programId.toString(), url);

    const transactionInstruction = intoTransactionInstructionFromVersionedMessage(ix, message);

    if (anchorProgram.program) {
        return (
            <ErrorBoundary
                fallback={
                    <UnknownDetailsCard
                        key={index}
                        index={index}
                        ix={ix}
                        message={message}
                        programName="Anchor Program"
                    />
                }
            >
                <AnchorDetailsCard
                    anchorProgram={anchorProgram.program}
                    index={index}
                    // Inner cards and child are not used since we do not know what CPIs
                    // will be called until simulation happens, and even then, all we
                    // get is logs, not the TransactionInstructions
                    innerCards={undefined}
                    ix={transactionInstruction}
                    // Always display success since it is too complicated to determine
                    // based on the simulation and pass that result here. Could be added
                    // later if desired, possibly similar to innerCards from parsing tx
                    // sim logs.
                    result={{ err: null }}
                    // Signature is not needed.
                    signature=""
                />
            </ErrorBoundary>
        );
    }

    /// Handle program-specific cards here
    //  - keep signature (empty string as we do not submit anything) for backward compatibility with the data from Transaction
    //  - result is `err: null` as at this point there should not be errors
    const result = { err: null };
    const signature = '';

    console.log(transactionInstruction?.programId.toString())
    switch (transactionInstruction?.programId.toString()) {
        case ASSOCIATED_TOKEN_PROGRAM_ID.toString(): {
            // NOTE: current limitation is that innerInstructions won't be present at the AssociatedTokenDetailsCard. For that purpose we might need to simulateTransactions to get them.

            const asParsedInstruction = intoParsedInstruction(transactionInstruction);
            return (
                <AssociatedTokenDetailsCard
                    key={index}
                    ix={asParsedInstruction}
                    raw={ix}
                    message={message}
                    index={index}
                    result={result}
                />
            );
        }
        case ComputeBudgetProgram.programId.toString(): {
            return (
                <ComputeBudgetDetailsCard
                    key={index}
                    ix={transactionInstruction}
                    index={index}
                    result={result}
                    signature={signature}
                    InstructionCardComponent={BaseInstructionCard}
                />
            );
        }
        case SystemProgram.programId.toString(): {
            console.log({ transactionInstruction }, message);
            const asParsedInstruction = intoParsedInstruction(transactionInstruction);
            //const asParsedTransaction = intoParsedTransaction(tx);
            break;
            return (
                <SystemDetailsCard
                    key={index}
                    ix={asParsedInstruction}
                    tx={asParsedInstruction}
                    index={index}
                    result={result}
                    signature=""
                    message={transactionInstruction}
                />
            );
        }
        case TOKEN_PROGRAM_ID.toString(): {
            console.log({ transactionInstruction }, message);
            const asParsedInstruction = intoParsedInstruction(transactionInstruction);
            //const asParsedTransaction = intoParsedTransaction(tx);
            break;
            return (
                <SystemDetailsCard
                    key={index}
                    ix={asParsedInstruction}
                    tx={asParsedInstruction}
                    index={index}
                    result={result}
                    signature=""
                    message={transactionInstruction}
                />
            );
        }
        default: {
            // unknown program; allow to render the next card
        }
    }

    return <UnknownDetailsCard key={index} index={index} ix={ix} message={message} programName={programName} />;
}
