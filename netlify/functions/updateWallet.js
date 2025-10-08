import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

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
        const { userId, walletAddress } = JSON.parse(event.body);

        if (!userId || !walletAddress) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing required fields: userId, walletAddress' })
            };
        }

        // Проверяем наличие переменных окружения
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Server configuration error: Missing Supabase credentials' })
            };
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        // Обновляем кошелек пользователя
        const { data, error } = await supabase
            .from('tonjacket')
            .update({ 
                wallet: walletAddress,
                updated_at: new Date().toISOString()
            })
            .eq('telegram_user_id', userId)
            .select()
            .single();

        if (error) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Database error: ' + error.message })
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true, 
                data: data,
                message: 'Wallet updated successfully'
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