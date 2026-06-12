const hre = require("hardhat");

const VOTING_ADDRESS = "0xc6e7DF5E7b4f2A278906862b61205850344D4e7d";
const TALLY_VERIFIER_ADDRESS = "0x59b670e9fA9D0A427751Af201D676719a970857b";

async function getContract(signerIndex = 0) {
  const signers = await hre.ethers.getSigners();
  const signer = signers[signerIndex];

  const votingAbi =
    require("../artifacts/contracts/E_Voting.sol/E_Voting.json").abi;

  const tallyVerifierAbi =
    require("../artifacts/contracts/TallyVerifier.sol/TallyVerifierOnChain.json").abi;

  const votingContract = new hre.ethers.Contract(
    VOTING_ADDRESS,
    votingAbi,
    signer,
  );

  const tallyVerifierContract = new hre.ethers.Contract(
    TALLY_VERIFIER_ADDRESS,
    tallyVerifierAbi,
    signer,
  );

  return {
    signer,
    votingContract,
    tallyVerifierContract,
  };
}

module.exports = { getContract };
