import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS, GET'
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
        const { 
            userId, 
            amount, 
            transactionType, 
            transactionData, 
            walletHistoryUrl,
            userWallet,
            timestamp 
        } = JSON.parse(event.body);

        if (!userId || !amount) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing required fields: userId, amount' })
            };
        }

        // 🔴 ДЕТАЛЬНОЕ ЛОГИРОВАНИЕ ВСЕХ ДАННЫХ ТРАНЗАКЦИИ
        console.log('=== DEPOSIT REQUEST DETAILS ===');
        console.log('User ID:', userId);
        console.log('Amount:', amount, 'TON');
        console.log('Transaction Type:', transactionType || 'NOT PROVIDED');
        console.log('Transaction Data:', transactionData ? 
            (transactionData.length > 100 ? transactionData.substring(0, 100) + '...' : transactionData) 
            : 'NOT PROVIDED');
        console.log('Wallet History URL:', walletHistoryUrl || 'NOT PROVIDED');
        console.log('User Wallet:', userWallet || 'NOT PROVIDED');
        console.log('Timestamp:', timestamp || 'NOT PROVIDED');
        console.log('Deposit Wallet:', "UQB_2coQNHxdWZN0b7y9QUy13jLl2XNaN2yPcicFJbCbhSEK");
        console.log('==============================');

        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            console.error('Missing Supabase environment variables');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    error: 'Server configuration error: Missing Supabase credentials'
                })
            };
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        // Получаем текущие значения
        const { data: currentUser, error: fetchError } = await supabase
            .from('tonjacket')
            .select('ton_amount, deposit_amount')
            .eq('telegram_user_id', userId)
            .single();

        if (fetchError) {
            console.error('Error fetching user data:', fetchError);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Failed to fetch user data: ' + fetchError.message })
            };
        }

        // Рассчитываем сумму с бонусом 1.5x
        const depositAmountFloat = parseFloat(amount);
        const bonusMultiplier = 1.5;
        const totalAmountWithBonus = depositAmountFloat * bonusMultiplier;
        
        const currentTonAmount = parseFloat(currentUser.ton_amount) || 0;
        const currentDepositAmount = parseFloat(currentUser.deposit_amount) || 0;
        
        const newTonAmount = currentTonAmount + totalAmountWithBonus;
        const newDepositAmount = currentDepositAmount + depositAmountFloat;

        console.log('💰 Balance update details:', {
            oldBalance: currentTonAmount,
            deposited: depositAmountFloat,
            bonus: totalAmountWithBonus - depositAmountFloat,
            newBalance: newTonAmount,
            totalReceived: totalAmountWithBonus
        });

        // Обновляем данные
        const { data: userData, error: updateError } = await supabase
            .from('tonjacket')
            .update({ 
                ton_amount: newTonAmount,
                deposit_amount: newDepositAmount,
                updated_at: new Date().toISOString()
            })
            .eq('telegram_user_id', userId)
            .select()
            .single();

        if (updateError) {
            console.error('Error updating user balance:', updateError);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Failed to update user balance: ' + updateError.message })
            };
        }

        console.log('✅ Successfully updated user balance with bonus');

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true, 
                data: userData,
                bonusApplied: true,
                depositedAmount: depositAmountFloat,
                receivedAmount: totalAmountWithBonus,
                bonusAmount: totalAmountWithBonus - depositAmountFloat,
                transactionType: transactionType,
                walletHistoryUrl: walletHistoryUrl,
                message: `TON deposited successfully! You received ${totalAmountWithBonus.toFixed(2)} TON (${depositAmountFloat.toFixed(2)} + ${(totalAmountWithBonus - depositAmountFloat).toFixed(2)} bonus)`
            })
        };

    } catch (error) {
        console.error('❌ Error in deposit-ton function:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error: ' + error.message })
        };
    }
};