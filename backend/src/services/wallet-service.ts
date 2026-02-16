export type MintInput = {
  userId: string;
  artistId: string;
  metadataUri: string;
};

export type MintResult = {
  tokenId: string;
  txHash: string;
  chain: 'polygon';
};

export function mintNft(input: MintInput): MintResult {
  return {
    tokenId: `nft_${Math.random().toString(36).slice(2, 9)}`,
    txHash: `0x${Math.random().toString(16).slice(2).padEnd(64, '0').slice(0, 64)}`,
    chain: 'polygon'
  };
}

export function validateAttendanceProof(streamId: string, userId: string): boolean {
  return streamId.length > 0 && userId.length > 0;
}
