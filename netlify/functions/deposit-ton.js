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
        const { userId, amount, transactionHash } = JSON.parse(event.body);

        if (!userId || !amount) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing required fields: userId, amount' })
            };
        }

        // 🔴 ВАЖНО: Логируем хэш транзакции
        console.log('Processing deposit for user:', userId, 'amount:', amount, 'transactionHash:', transactionHash || 'NOT PROVIDED');

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
        const bonusMultiplier = 1.5; // Бонус 50%
        const totalAmountWithBonus = depositAmountFloat * bonusMultiplier;
        
        const currentTonAmount = parseFloat(currentUser.ton_amount) || 0;
        const currentDepositAmount = parseFloat(currentUser.deposit_amount) || 0;
        
        const newTonAmount = currentTonAmount + totalAmountWithBonus;
        const newDepositAmount = currentDepositAmount + depositAmountFloat;

        console.log('Deposit details:', {
            deposited: depositAmountFloat,
            withBonus: totalAmountWithBonus,
            currentTon: currentTonAmount,
            newTon: newTonAmount,
            transactionHash: transactionHash || 'NOT PROVIDED'
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

        console.log('Successfully updated user balance with bonus. Transaction hash:', transactionHash || 'UNKNOWN');

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
                transactionHash: transactionHash, // Возвращаем хэш в ответе
                message: `TON deposited successfully! You received ${totalAmountWithBonus} TON (${depositAmountFloat} + ${totalAmountWithBonus - depositAmountFloat} bonus)`
            })
        };

    } catch (error) {
        console.error('Error in deposit-ton function:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error: ' + error.message })
        };
    }
};