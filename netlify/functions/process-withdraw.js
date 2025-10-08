import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const BOT_TOKEN = process.env.BOT_TOKEN;
const CREATOR_ID = process.env.CREATOR_ID;

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { userId, amount, walletAddress } = JSON.parse(event.body);

        if (!userId || !amount || !walletAddress) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing required fields' })
            };
        }

        // Инициализация Supabase
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        // Получаем данные пользователя
        const { data: userData, error: userError } = await supabase
            .from('tonjacket')
            .select('*')
            .eq('telegram_user_id', userId)
            .single();

        if (userError) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'User not found' })
            };
        }

        const amountFloat = parseFloat(amount);
        const currentTonAmount = parseFloat(userData.ton_amount) || 0;

        // Проверяем достаточно ли средств
        if (currentTonAmount < amountFloat) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Insufficient funds' })
            };
        }

        // Обновляем баланс пользователя
        const newTonAmount = currentTonAmount - amountFloat;
        const newWithdrawAmount = (parseFloat(userData.withdraw_amount) || 0) + amountFloat;

        const { data: updatedUser, error: updateError } = await supabase
            .from('tonjacket')
            .update({
                ton_amount: newTonAmount,
                withdraw_amount: newWithdrawAmount,
                updated_at: new Date().toISOString()
            })
            .eq('telegram_user_id', userId)
            .select()
            .single();

        if (updateError) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Failed to update balance' })
            };
        }

        // Отправляем уведомления через Telegram Bot API
        const username = userData.telegram_username || userData.first_name || 'Unknown';
        const betAmount = userData.bet_amount || 0;

        // Уведомление пользователю
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: userId,
                text: `⏳ *Withdrawal Request Received*\n\n💎 *Amount:* ${amount} TON\n👛 *Wallet:* \`${walletAddress}\`\n\n📋 Your withdrawal is being processed. You will receive a notification from your wallet when the funds arrive in your balance.\n\nThank you for using TON Jacket! 🎰`,
                parse_mode: 'Markdown'
            })
        });

        // Уведомление создателю
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: CREATOR_ID,
                text: `🔄 *NEW WITHDRAWAL REQUEST*\n\n👤 *User:* ${username}\n🆔 *ID:* ${userId}\n💎 *Amount:* ${amount} TON\n👛 *Wallet:* \`${walletAddress}\`\n🎰 *Total Bets:* ${betAmount} TON\n⏰ *Time:* ${new Date().toLocaleString()}`,
                parse_mode: 'Markdown'
            })
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true, 
                data: updatedUser,
                message: 'Withdrawal processed successfully'
            })
        };

    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error: ' + error.message })
        };
    }
};