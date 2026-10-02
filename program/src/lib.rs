//! study_escrow: holds a study's budget and pays participants by fixed rules.
//!
//! What the program guarantees, for anyone to verify on-chain:
//!   1. The budget (reward x max_participants) is locked when the study is created.
//!   2. A payout is always exactly `reward`.
//!   3. A wallet can be paid at most once per study (the Receipt account can only be created once).
//!   4. Only the researcher can close the study, and the remainder goes back to the researcher.
//!
//! What it does not check: whether the participant really finished the survey.
//! That decision is made off-chain by the payout authority (the platform's key).
//!
//! Build and deploy with Solana Playground (https://beta.solpg.io): see README.md.

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

// Solana Playground replaces this address when you run `build`.
declare_id!("11111111111111111111111111111111");

#[program]
pub mod study_escrow {
    use super::*;

    /// Creates the study and moves the full budget from the researcher into the vault.
    pub fn create_study(
        ctx: Context<CreateStudy>,
        study_id: u64,
        reward: u64,
        max_participants: u32,
    ) -> Result<()> {
        require!(reward > 0, EscrowError::InvalidReward);
        require!(max_participants > 0, EscrowError::InvalidMaxParticipants);
        let total = reward
            .checked_mul(max_participants as u64)
            .ok_or(EscrowError::Overflow)?;

        let study = &mut ctx.accounts.study;
        study.researcher = ctx.accounts.researcher.key();
        study.payout_authority = ctx.accounts.payout_authority.key();
        study.mint = ctx.accounts.mint.key();
        study.study_id = study_id;
        study.reward = reward;
        study.max_participants = max_participants;
        study.paid_count = 0;
        study.closed = false;
        study.bump = ctx.bumps.study;
        study.vault_bump = ctx.bumps.vault;

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.researcher_token.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.researcher.to_account_info(),
                },
            ),
            total,
        )?;
        Ok(())
    }

    /// Pays one fixed reward to a participant. Fails if this wallet was already paid.
    pub fn payout(ctx: Context<Payout>) -> Result<()> {
        require!(!ctx.accounts.study.closed, EscrowError::StudyClosed);
        require!(
            ctx.accounts.study.paid_count < ctx.accounts.study.max_participants,
            EscrowError::StudyFull
        );

        let receipt = &mut ctx.accounts.receipt;
        receipt.participant = ctx.accounts.participant.key();
        receipt.paid_at = Clock::get()?.unix_timestamp;
        receipt.bump = ctx.bumps.receipt;

        let researcher = ctx.accounts.study.researcher;
        let study_id = ctx.accounts.study.study_id.to_le_bytes();
        let bump = [ctx.accounts.study.bump];
        let reward = ctx.accounts.study.reward;
        let seeds: &[&[u8]] = &[b"study", researcher.as_ref(), study_id.as_ref(), bump.as_ref()];
        let signer: &[&[&[u8]]] = &[seeds];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.participant_token.to_account_info(),
                    authority: ctx.accounts.study.to_account_info(),
                },
                signer,
            ),
            reward,
        )?;

        let study = &mut ctx.accounts.study;
        study.paid_count = study
            .paid_count
            .checked_add(1)
            .ok_or(EscrowError::Overflow)?;
        Ok(())
    }

    /// Ends the study and returns whatever is left in the vault to the researcher.
    pub fn close_study(ctx: Context<CloseStudy>) -> Result<()> {
        require!(!ctx.accounts.study.closed, EscrowError::StudyClosed);
        let remaining = ctx.accounts.vault.amount;

        if remaining > 0 {
            let researcher = ctx.accounts.study.researcher;
            let study_id = ctx.accounts.study.study_id.to_le_bytes();
            let bump = [ctx.accounts.study.bump];
            let seeds: &[&[u8]] =
                &[b"study", researcher.as_ref(), study_id.as_ref(), bump.as_ref()];
            let signer: &[&[&[u8]]] = &[seeds];

            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.vault.to_account_info(),
                        to: ctx.accounts.researcher_token.to_account_info(),
                        authority: ctx.accounts.study.to_account_info(),
                    },
                    signer,
                ),
                remaining,
            )?;
        }

        ctx.accounts.study.closed = true;
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(study_id: u64)]
pub struct CreateStudy<'info> {
    /// The researcher who owns the study and funds it.
    pub researcher: Signer<'info>,
    /// Pays for the new accounts, so the researcher needs no SOL.
    #[account(mut)]
    pub fee_payer: Signer<'info>,
    /// CHECK: only stored. This is the one key later allowed to trigger payouts.
    pub payout_authority: UncheckedAccount<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        init,
        payer = fee_payer,
        space = 8 + Study::SIZE,
        seeds = [b"study", researcher.key().as_ref(), study_id.to_le_bytes().as_ref()],
        bump
    )]
    pub study: Account<'info, Study>,
    #[account(
        init,
        payer = fee_payer,
        seeds = [b"vault", study.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = study
    )]
    pub vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = researcher_token.owner == researcher.key() @ EscrowError::WrongTokenAccount,
        constraint = researcher_token.mint == mint.key() @ EscrowError::WrongTokenAccount
    )]
    pub researcher_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Payout<'info> {
    /// Must be the key stored in the study at creation.
    pub payout_authority: Signer<'info>,
    #[account(mut)]
    pub fee_payer: Signer<'info>,
    #[account(
        mut,
        has_one = payout_authority @ EscrowError::WrongAuthority,
        seeds = [b"study", study.researcher.as_ref(), study.study_id.to_le_bytes().as_ref()],
        bump = study.bump
    )]
    pub study: Account<'info, Study>,
    #[account(mut, seeds = [b"vault", study.key().as_ref()], bump = study.vault_bump)]
    pub vault: Account<'info, TokenAccount>,
    /// CHECK: the wallet being paid. It does not sign and nothing is read from it.
    pub participant: UncheckedAccount<'info>,
    #[account(
        mut,
        constraint = participant_token.owner == participant.key() @ EscrowError::WrongTokenAccount,
        constraint = participant_token.mint == study.mint @ EscrowError::WrongTokenAccount
    )]
    pub participant_token: Account<'info, TokenAccount>,
    /// Created here; a second payout to the same wallet fails because it already exists.
    #[account(
        init,
        payer = fee_payer,
        space = 8 + Receipt::SIZE,
        seeds = [b"receipt", study.key().as_ref(), participant.key().as_ref()],
        bump
    )]
    pub receipt: Account<'info, Receipt>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CloseStudy<'info> {
    pub researcher: Signer<'info>,
    #[account(
        mut,
        has_one = researcher @ EscrowError::WrongAuthority,
        seeds = [b"study", study.researcher.as_ref(), study.study_id.to_le_bytes().as_ref()],
        bump = study.bump
    )]
    pub study: Account<'info, Study>,
    #[account(mut, seeds = [b"vault", study.key().as_ref()], bump = study.vault_bump)]
    pub vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = researcher_token.owner == researcher.key() @ EscrowError::WrongTokenAccount,
        constraint = researcher_token.mint == study.mint @ EscrowError::WrongTokenAccount
    )]
    pub researcher_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[account]
pub struct Study {
    pub researcher: Pubkey,
    pub payout_authority: Pubkey,
    pub mint: Pubkey,
    pub study_id: u64,
    /// In token base units (USDC has 6 decimals: 1 USDC = 1_000_000).
    pub reward: u64,
    pub max_participants: u32,
    pub paid_count: u32,
    pub closed: bool,
    pub bump: u8,
    pub vault_bump: u8,
}

impl Study {
    pub const SIZE: usize = 32 + 32 + 32 + 8 + 8 + 4 + 4 + 1 + 1 + 1;
}

#[account]
pub struct Receipt {
    pub participant: Pubkey,
    pub paid_at: i64,
    pub bump: u8,
}

impl Receipt {
    pub const SIZE: usize = 32 + 8 + 1;
}

#[error_code]
pub enum EscrowError {
    #[msg("The reward must be greater than zero")]
    InvalidReward,
    #[msg("The number of participants must be greater than zero")]
    InvalidMaxParticipants,
    #[msg("Amount overflow")]
    Overflow,
    #[msg("This study is closed")]
    StudyClosed,
    #[msg("All places in this study are paid")]
    StudyFull,
    #[msg("This key is not allowed to do that")]
    WrongAuthority,
    #[msg("Token account does not match the expected owner or mint")]
    WrongTokenAccount,
}
