const anchor = require('@project-serum/anchor');
const assert = require("assert");

describe('apyapp', () => {

  // Configure the client to use the local cluster.
  const provider = anchor.Provider.local();
  anchor.setProvider(provider);
  const program = anchor.workspace.Apyapp;

  let mint = null;
  let from = null;
  let to = null;

  let fromProg = null;

  const minterAccount = anchor.web3.Keypair.generate();


  // Intitialize the minter account which will receive the SPL token from the user
  it("Initialize Minter", async () => {

    const tx = await program.rpc.initialize(
      
      {
        accounts: {
          user : provider.wallet.publicKey,
          minterAccount : minterAccount.publicKey,
          systemProgram : anchor.web3.SystemProgram.programId

        },
        signers: [
          minterAccount
        ]
      }
    );

  });
  
  // Initializes the test state
  it("Initializes test state", async () => {

    mint = await createMint(provider);
    from = await createTokenAccount(provider, mint, provider.wallet.publicKey);
    to = await createTokenAccount(provider, mint, minterAccount.publicKey);

  });


  // Mint tokens to the user account so that we can begin testing, not a prod scenario
  it("Mints a token", async () => {
    await program.rpc.proxyMintTo(new anchor.BN(1000), {
      accounts: {
        authority: provider.wallet.publicKey,
        mint,
        to: from,
        tokenProgram: TokenInstructions.TOKEN_PROGRAM_ID,
        minterAccount: minterAccount.publicKey,
        user : provider.wallet.publicKey
      },
    });

    const fromAccount = await getTokenAccount(provider, from);

    assert.ok(fromAccount.amount.eq(new anchor.BN(1000)));
  });

  // Lock tokens to earn APY
  it("Create a lock", async () => {

    await program.rpc.proxyTransfer(new anchor.BN(400), {
      accounts: {
        authority: provider.wallet.publicKey,
        to,
        from,
        tokenProgram: TokenInstructions.TOKEN_PROGRAM_ID,
        minterAccount: minterAccount.publicKey,
        user : provider.wallet.publicKey
      },
    });

    const fromAccount = await getTokenAccount(provider, from);
    const toAccount = await getTokenAccount(provider, to);

    let account = await program.account.minterAccount.fetch(
      minterAccount.publicKey
    );
      
    await console.log(account);
    assert.ok(fromAccount.amount.eq(new anchor.BN(600)));
    await console.log(fromAccount.amount.toString(),"---");
    assert.ok(toAccount.amount.eq(new anchor.BN(400)));
    await console.log(toAccount.amount)

  });
  
  // Unlock Tokens
  it("Unlock tokens and give up staked rewards till now", async () => {

    await program.rpc.proxyTransferFrom(new anchor.BN(400), {
      accounts: {
        authority: minterAccount.publicKey,
        to: from,
        from: to,
        tokenProgram: TokenInstructions.TOKEN_PROGRAM_ID,
        minterAccount: minterAccount.publicKey,
        user : provider.wallet.publicKey
      },signers: [
        minterAccount
      ]
    });

    const fromAccount = await getTokenAccount(provider, from);
    const toAccount = await getTokenAccount(provider, to);

    let account = await program.account.minterAccount.fetch(
      minterAccount.publicKey
    );
      
    await console.log(account);
    // assert.ok(fromAccount.amount.eq(new anchor.BN(600)));
    await console.log(fromAccount.amount.toString(),"---");
    // assert.ok(toAccount.amount.eq(new anchor.BN(400)));
    await console.log(toAccount.amount)

  });

  // Lock tokens again
  it("Transfers token again", async () => {

    await program.rpc.proxyTransfer(new anchor.BN(400), {
      accounts: {
        authority: provider.wallet.publicKey,
        to,
        from,
        tokenProgram: TokenInstructions.TOKEN_PROGRAM_ID,
        minterAccount: minterAccount.publicKey,
        user : provider.wallet.publicKey
      },
    });

    const fromAccount = await getTokenAccount(provider, from);
    const toAccount = await getTokenAccount(provider, to);

    let account = await program.account.minterAccount.fetch(
      minterAccount.publicKey
    );
      
    await console.log(account);
    assert.ok(fromAccount.amount.eq(new anchor.BN(600)));
    await console.log(fromAccount.amount.toString(),"---");
    assert.ok(toAccount.amount.eq(new anchor.BN(400)));
    await console.log(toAccount.amount)

  });


  // Claim the rewards received till now
  it("Claim tokens", async () => {

    let account = await program.account.minterAccount.fetch(
      minterAccount.publicKey
    );
    let amount = account.userBalances[0];
    let locktime = account.userLocktime[0];
    console.log(amount.toString(10),locktime.toString(10))

    let fromAccount = await getTokenAccount(provider, from);
    await console.log(fromAccount.amount.toString(),"---1");
    console.log(fromAccount.amount.toString(10));
    await sleep(10000);
    
    await program.rpc.claimStake(amount,locktime, {
      accounts: {
        authority: provider.wallet.publicKey,
        mint,
        to: from,
        tokenProgram: TokenInstructions.TOKEN_PROGRAM_ID,
        minterAccount: minterAccount.publicKey,
        user : provider.wallet.publicKey
      },
    });
    
    fromAccount = await getTokenAccount(provider, from);
    await console.log(fromAccount.amount.toString(),"---2");
    
    account = await program.account.minterAccount.fetch(
      minterAccount.publicKey
      );
      amount = account.userBalances[0];
      locktime = account.userLocktime[0];
      console.log(amount.toString(10),locktime.toString(10))
      console.log(fromAccount.amount.toString(10));


  });

  // Set new mint authority... only for testing purposes
  it("Set new mint authority", async () => {

    const newMintAuthority = anchor.web3.Keypair.generate();
    await program.rpc.proxySetAuthority(
      { mintTokens: {} },
      newMintAuthority.publicKey,
      {
        accounts: {
          accountOrMint: mint,
          currentAuthority: provider.wallet.publicKey,
          tokenProgram: TokenInstructions.TOKEN_PROGRAM_ID,
        },
      }
    );

    const mintInfo = await getMintInfo(provider, mint);
    assert.ok(mintInfo.mintAuthority.equals(newMintAuthority.publicKey));

  });
  
});

const serumCmn = require("@project-serum/common");
const TokenInstructions = require("@project-serum/serum").TokenInstructions;

const TOKEN_PROGRAM_ID = new anchor.web3.PublicKey(
  TokenInstructions.TOKEN_PROGRAM_ID.toString()
);

async function getTokenAccount(provider, addr) {
  return await serumCmn.getTokenAccount(provider, addr);
}

async function getMintInfo(provider, mintAddr) {
  return await serumCmn.getMintInfo(provider, mintAddr);
}

async function createMint(provider, authority) {
  if (authority === undefined) {
    authority = provider.wallet.publicKey;
  }
  const mint = anchor.web3.Keypair.generate();
  const instructions = await createMintInstructions(
    provider,
    authority,
    mint.publicKey
  );

  const tx = new anchor.web3.Transaction();
  tx.add(...instructions);

  await provider.send(tx, [mint]);

  return mint.publicKey;
}

async function createMintInstructions(provider, authority, mint) {
  let instructions = [
    anchor.web3.SystemProgram.createAccount({
      fromPubkey: provider.wallet.publicKey,
      newAccountPubkey: mint,
      space: 82,
      lamports: await provider.connection.getMinimumBalanceForRentExemption(82),
      programId: TOKEN_PROGRAM_ID,
    }),
    TokenInstructions.initializeMint({
      mint,
      decimals: 0,
      mintAuthority: authority,
    }),
  ];
  return instructions;
}

async function createTokenAccount(provider, mint, owner) {
  const vault = anchor.web3.Keypair.generate();
  const tx = new anchor.web3.Transaction();
  tx.add(
    ...(await createTokenAccountInstrs(provider, vault.publicKey, mint, owner))
  );
  await provider.send(tx, [vault]);
  return vault.publicKey;
}

async function createTokenAccountInstrs(
  provider,
  newAccountPubkey,
  mint,
  owner,
  lamports
) {
  if (lamports === undefined) {
    lamports = await provider.connection.getMinimumBalanceForRentExemption(165);
  }
  return [
    anchor.web3.SystemProgram.createAccount({
      fromPubkey: provider.wallet.publicKey,
      newAccountPubkey,
      space: 165,
      lamports,
      programId: TOKEN_PROGRAM_ID,
    }),
    TokenInstructions.initializeAccount({
      account: newAccountPubkey,
      mint,
      owner,
    }),
  ];
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}