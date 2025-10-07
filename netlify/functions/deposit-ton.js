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
        const { userId, amount } = JSON.parse(event.body);

        if (!userId || !amount) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing required fields: userId, amount' })
            };
        }

        console.log('Processing deposit for user:', userId, 'amount:', amount);
        console.log('Supabase URL:', SUPABASE_URL ? 'Set' : 'Not set');
        console.log('Supabase Anon Key:', SUPABASE_ANON_KEY ? 'Set' : 'Not set');

        // Используем объявленные константы
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            console.error('Missing Supabase environment variables');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    error: 'Server configuration error: Missing Supabase credentials',
                    details: {
                        hasUrl: !!SUPABASE_URL,
                        hasAnonKey: !!SUPABASE_ANON_KEY
                    }
                })
            };
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        // Сначала получаем текущие значения для точного расчета
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

        // Рассчитываем новые значения
        const currentTonAmount = parseFloat(currentUser.ton_amount) || 0;
        const currentDepositAmount = parseFloat(currentUser.deposit_amount) || 0;
        const depositAmountFloat = parseFloat(amount);
        
        const newTonAmount = currentTonAmount + depositAmountFloat;
        const newDepositAmount = currentDepositAmount + depositAmountFloat;

        console.log('Current TON:', currentTonAmount, 'Current Deposit:', currentDepositAmount);
        console.log('Adding:', depositAmountFloat);
        console.log('New TON:', newTonAmount, 'New Deposit:', newDepositAmount);

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

        console.log('Successfully updated user balance');

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true, 
                data: userData,
                message: 'TON deposited successfully'
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