import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

exports.handler = async (event, context) => {
    const headers = {
        "Access-Control-Allow-Origin": CORS_ORIGIN,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Max-Age": "86400",
    };

    if (event.httpMethod === "OPTIONS") {
        return {
            statusCode: 200,
            headers: headers,
            body: "",
        };
    }

    try {
        let requestBody;
        if (event.body) {
            requestBody = JSON.parse(event.body);
        } else {
            return {
                statusCode: 400,
                headers: headers,
                body: JSON.stringify({ success: false, error: "Request body is empty" }),
            };
        }

        const { telegramId, tonAmount } = requestBody;

        if (!telegramId || tonAmount === undefined) {
            return {
                statusCode: 400,
                headers: headers,
                body: JSON.stringify({ success: false, error: "Missing telegramId or tonAmount" }),
            };
        }

        // Обновляем ton_amount (устанавливаем абсолютное значение)
        const { data, error: updateError } = await supabase
            .from('tonjacket')
            .update({ 
                ton_amount: parseFloat(tonAmount.toFixed(3))
            })
            .eq('telegram_user_id', telegramId);

        if (updateError) {
            console.error('Error updating TON amount:', updateError);
            return {
                statusCode: 500,
                headers: headers,
                body: JSON.stringify({ success: false, error: "Error updating TON amount" }),
            };
        }

        // Получаем обновленные данные пользователя для подтверждения
        const { data: updatedUser, error: selectError } = await supabase
            .from('tonjacket')
            .select('ton_amount')
            .eq('telegram_user_id', telegramId)
            .single();

        if (selectError) {
            console.error('Error fetching updated TON amount:', selectError);
            return {
                statusCode: 500,
                headers: headers,
                body: JSON.stringify({ success: false, error: "Error fetching updated TON amount" }),
            };
        }

        return {
            statusCode: 200,
            headers: headers,
            body: JSON.stringify({ 
                success: true, 
                tonAmount: updatedUser.ton_amount 
            }),
        };

    } catch (error) {
        console.error("update-ton.js: Netlify Function error:", error);
        return {
            statusCode: 500,
            headers: headers,
            body: JSON.stringify({ success: false, error: error.message }),
        };
    }
};