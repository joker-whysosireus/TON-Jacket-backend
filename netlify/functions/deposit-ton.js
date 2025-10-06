import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

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
        const { userId, amount } = JSON.parse(event.body);

        if (!userId || !amount) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing required fields: userId, amount' })
            };
        }

        // Initialize Supabase client
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
        
        if (!supabaseUrl || !supabaseKey) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Server configuration error' })
            };
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // Update user's TON balance and total deposited amount in tonjacket table
        const { data: userData, error: updateError } = await supabase
            .from('tonjacket')
            .update({ 
                ton_amount: supabase.raw(`ton_amount + ${parseFloat(amount)}`),
                deposit_amount: supabase.raw(`COALESCE(deposit_amount, 0) + ${parseFloat(amount)}`),
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
                body: JSON.stringify({ error: 'Failed to update user balance' })
            };
        }

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