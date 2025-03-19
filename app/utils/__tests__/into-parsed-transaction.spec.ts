import * as stubs from '@/app/__tests__/mock-stubs';
import * as mock from '@/app/__tests__/mocks';
import { intoTransactionInstructionFromVersionedMessage } from '@/app/components/inspector/utils';

import { intoParsedTransaction } from '../parsed-tx';
import { systemProgramTransactionInstructionParser } from '../parsers';

describe('intoParsedTransaction', () => {
    test("should return ParsedTransaction compatible data for SystemProgram::transfer's VersionedMessage", async () => {
        const m = mock.deserializeMessage(stubs.systemTransferMsg);

        const ix = intoParsedTransaction(m);
        console.log({ ix }, m);
        expect(ix.message.accountKeys).toEqual([]);
        expect(ix.message.addressTableLookups).toHaveLength(0);
        expect(ix.message.recentBlockhash).toEqual('');
        expect(ix.message.instructions).toHaveLength(0);
    });
});
