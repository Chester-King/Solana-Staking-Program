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

  // let mauthorty ;
  // let mintKP;
  // it("Setting the mint",async()=>{

  //   mauthorty = minterAccount.publicKey;
   
  //   mintKP = anchor.web3.Keypair.generate();
  //   const instructions = await createMintInstructions(
  //     provider,
  //     mauthorty,
  //     mintKP.publicKey
  //   );
  
  //   const tx = new anchor.web3.Transaction();
  //   tx.add(...instructions);
    
  //   await provider.send(tx, [mintKP]);
    
  //   let mint2 = mintKP.publicKey;
    
  //   fromProg = await createTokenAccount(provider,mint2,minterAccount.publicKey);

  // })

  // it("Trigger Mint to program",async()=>{

  //   await program.rpc.mintToProgram(new anchor.BN(2000), {
  //     accounts: {
  //       authority: mauthorty.publicKey,
  //       mint: mintKP,
  //       to: fromProg,
  //       tokenProgram: TokenInstructions.TOKEN_PROGRAM_ID,
  //     },
  //     // signers: [
  //     //   dataAccount
  //     // ]
  //   });

  //   const fromAccount = await getTokenAccount(provider, fromProg);

  //   assert.ok(fromAccount.amount.eq(new anchor.BN(2000)));

  // })


  it("Initializes test state", async () => {

    mint = await createMint(provider);
    from = await createTokenAccount(provider, mint, provider.wallet.publicKey);
    // to = await createTokenAccount(provider, mint, provider.wallet.publicKey);
    to = await createTokenAccount(provider, mint, minterAccount.publicKey);

  });

  it("Mints a token", async () => {
    await program.rpc.proxyMintTo(new anchor.BN(1000), {
      accounts: {
        authority: provider.wallet.publicKey,
        mint,
        to: from,
        tokenProgram: TokenInstructions.TOKEN_PROGRAM_ID,
      },
    });

    const fromAccount = await getTokenAccount(provider, from);

    assert.ok(fromAccount.amount.eq(new anchor.BN(1000)));
  });

  it("Transfers a token", async () => {

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
    assert.ok(toAccount.amount.eq(new anchor.BN(400)));
    await console.log(toAccount.amount)

  });
  
  
  it("Transfers back token", async () => {

    await program.rpc.proxyTransferFrom(new anchor.BN(300), {
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
    // assert.ok(toAccount.amount.eq(new anchor.BN(400)));
    await console.log(toAccount.amount)

  });

  it("Burns a token", async () => {

    

  });

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