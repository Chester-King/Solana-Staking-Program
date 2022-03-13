use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, MintTo, SetAuthority, Transfer};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod apyapp {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> ProgramResult {
        let _minter_account = &mut ctx.accounts.minter_account;

        
        Ok(())
    }

    // Function to Create a lock
    pub fn proxy_transfer(ctx: Context<ProxyTransfer>, amount: u64) -> ProgramResult {
        token::transfer(ctx.accounts.into(), amount);
        let now_ts = Clock::get().unwrap().unix_timestamp as u64;
        let _minter_account = &mut ctx.accounts.minter_account;
        let _user_account = &mut ctx.accounts.user;
        
        if _minter_account.user_addresses.contains(&_user_account.to_account_info().key()){
            require!(false,CustomError::LockExist);
        }

        _minter_account.user_addresses.push(_user_account.to_account_info().key());
        _minter_account.user_balances.push(amount);
        _minter_account.user_locktime.push(now_ts);
        Ok(())
    }
    
    // Function to get back the tokens from the lock
    pub fn proxy_transfer_from(ctx: Context<ProxyTransferFrom>, amount: u64) -> ProgramResult {
        token::transfer(ctx.accounts.into(), amount);
        // let now_ts = Clock::get().unwrap().unix_timestamp as u64;
        let _minter_account = &mut ctx.accounts.minter_account;
        let _user_account = &mut ctx.accounts.user;
        
        let index = _minter_account.user_addresses.iter().position(|&r| r == _user_account.to_account_info().key()).unwrap();
        require!(_minter_account.user_balances[index]==amount,CustomError::InsufficentBalance);
        _minter_account.user_addresses.remove(index);
        _minter_account.user_balances.remove(index);
        _minter_account.user_locktime.remove(index);
        
        Ok(())
    }

    // Claim the tokens which are to be minted as return
    pub fn claim_stake(ctx: Context<ProxyMintTo>, amount: u64, acctime : u64) -> ProgramResult {
        let now_ts = Clock::get().unwrap().unix_timestamp as u64;
        let difference = now_ts-acctime;
        let total_year_seconds = 31536000;
        let claim_amount = (difference*amount)/(total_year_seconds*10);
        
        token::mint_to(ctx.accounts.into(), claim_amount);
        let _minter_account = &mut ctx.accounts.minter_account;
        let _user_account = &mut ctx.accounts.user;
        let index = _minter_account.user_addresses.iter().position(|&r| r == _user_account.to_account_info().key()).unwrap();
        require!(_minter_account.user_balances[index]==amount,CustomError::WrongInput);
        require!(_minter_account.user_locktime[index]==acctime,CustomError::WrongInput);
        _minter_account.user_locktime[index] = now_ts;
        Ok(())

        
        
    }
    

    // Test function to mint tokens - will be removed in prod
    pub fn proxy_mint_to(ctx: Context<ProxyMintTo>, amount: u64) -> ProgramResult {
        token::mint_to(ctx.accounts.into(), amount)
    }
    

    // Test function to burn tokens - will be removed in prod
    pub fn proxy_burn(ctx: Context<ProxyBurn>, amount: u64) -> ProgramResult {
        token::burn(ctx.accounts.into(), amount)
    }
    
    // Test function to set new authority
    pub fn proxy_set_authority(
        ctx: Context<ProxySetAuthority>,
        authority_type: AuthorityType,
        new_authority: Option<Pubkey>,
    ) -> ProgramResult {
        token::set_authority(ctx.accounts.into(), authority_type.into(), new_authority)
    }


}

// An enum for custom error codes
#[error]
pub enum CustomError {
    LockExist,
    InsufficentBalance,
    WrongInput
}


#[derive(AnchorSerialize, AnchorDeserialize)]
pub enum AuthorityType {
    MintTokens,
    FreezeAccount,
    AccountOwner,
    CloseAccount
}



#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = user, space = 16 + 500)]
    pub minter_account: Account<'info, MinterAccount>,
    pub user: Signer<'info>,
    pub system_program: Program <'info, System>,
}



#[derive(Accounts)]
pub struct ProxyTransfer<'info> {
    #[account(signer)]
    pub authority: AccountInfo<'info>,
    #[account(mut)]
    pub from: AccountInfo<'info>,
    #[account(mut)]
    pub to: AccountInfo<'info>,
    #[account(mut)]
    pub minter_account: Account<'info, MinterAccount>,
    pub token_program: AccountInfo<'info>,
    pub user: Signer<'info>
}


#[derive(Accounts)]
pub struct ProxyTransferFrom<'info> {
    #[account(signer)]
    pub authority: AccountInfo<'info>,
    #[account(mut)]
    pub from: AccountInfo<'info>,
    #[account(mut)]
    pub to: AccountInfo<'info>,
    #[account(mut)]
    pub minter_account: Account<'info, MinterAccount>,
    pub token_program: AccountInfo<'info>,
    pub user: Signer<'info>
}




#[account]
pub struct MinterAccount {
    pub user_addresses: Vec<Pubkey>,
    pub user_balances : Vec<u64>,
    pub user_locktime : Vec<u64>
}

#[derive(Accounts)]
pub struct ProxyMintTo<'info> {
    #[account(signer)]
    pub authority: AccountInfo<'info>,
    #[account(mut)]
    pub mint: AccountInfo<'info>,
    #[account(mut)]
    pub to: AccountInfo<'info>,
    #[account(mut)]
    pub minter_account: Account<'info, MinterAccount>,
    pub token_program: AccountInfo<'info>,
    pub user: Signer<'info>
}



#[derive(Accounts)]
pub struct ProxyBurn<'info> {
    #[account(signer)]
    pub authority: AccountInfo<'info>,
    #[account(mut)]
    pub mint: AccountInfo<'info>,
    #[account(mut)]
    pub to: AccountInfo<'info>,
    pub token_program: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct ProxySetAuthority<'info> {
    #[account(signer)]
    pub current_authority: AccountInfo<'info>,
    #[account(mut)]
    pub account_or_mint: AccountInfo<'info>,
    pub token_program: AccountInfo<'info>,
}

impl<'a, 'b, 'c, 'info> From<&mut ProxyTransfer<'info>>
    for CpiContext<'a, 'b, 'c, 'info, Transfer<'info>>
{
    fn from(accounts: &mut ProxyTransfer<'info>) -> CpiContext<'a, 'b, 'c, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: accounts.from.clone(),
            to: accounts.to.clone(),
            authority: accounts.authority.clone(),
        };
        let cpi_program = accounts.token_program.clone();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}


impl<'a, 'b, 'c, 'info> From<&mut ProxyTransferFrom<'info>>
    for CpiContext<'a, 'b, 'c, 'info, Transfer<'info>>
{
    fn from(accounts: &mut ProxyTransferFrom<'info>) -> CpiContext<'a, 'b, 'c, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: accounts.from.clone(),
            to: accounts.to.clone(),
            authority: accounts.authority.clone(),
        };
        let cpi_program = accounts.token_program.clone();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}

impl<'a, 'b, 'c, 'info> From<&mut ProxyMintTo<'info>>
    for CpiContext<'a, 'b, 'c, 'info, MintTo<'info>>
{
    fn from(accounts: &mut ProxyMintTo<'info>) -> CpiContext<'a, 'b, 'c, 'info, MintTo<'info>> {
        let cpi_accounts = MintTo {
            mint: accounts.mint.clone(),
            to: accounts.to.clone(),
            authority: accounts.authority.clone(),
        };
        let cpi_program = accounts.token_program.clone();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}



impl<'a, 'b, 'c, 'info> From<&mut ProxyBurn<'info>> for CpiContext<'a, 'b, 'c, 'info, Burn<'info>> {
    fn from(accounts: &mut ProxyBurn<'info>) -> CpiContext<'a, 'b, 'c, 'info, Burn<'info>> {
        let cpi_accounts = Burn {
            mint: accounts.mint.clone(),
            to: accounts.to.clone(),
            authority: accounts.authority.clone(),
        };
        let cpi_program = accounts.token_program.clone();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}

impl<'a, 'b, 'c, 'info> From<&mut ProxySetAuthority<'info>>
    for CpiContext<'a, 'b, 'c, 'info, SetAuthority<'info>>
{
    fn from(
        accounts: &mut ProxySetAuthority<'info>,
    ) -> CpiContext<'a, 'b, 'c, 'info, SetAuthority<'info>> {
        let cpi_accounts = SetAuthority {
            account_or_mint: accounts.account_or_mint.clone(),
            current_authority: accounts.current_authority.clone(),
        };
        let cpi_program = accounts.token_program.clone();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}

impl From<AuthorityType> for spl_token::instruction::AuthorityType {
    fn from(authority_ty: AuthorityType) -> spl_token::instruction::AuthorityType {
        match authority_ty {
            AuthorityType::MintTokens => spl_token::instruction::AuthorityType::MintTokens,
            AuthorityType::FreezeAccount => spl_token::instruction::AuthorityType::FreezeAccount,
            AuthorityType::AccountOwner => spl_token::instruction::AuthorityType::AccountOwner,
            AuthorityType::CloseAccount => spl_token::instruction::AuthorityType::CloseAccount,
        }
    }
}
