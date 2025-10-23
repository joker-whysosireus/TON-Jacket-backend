import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

exports.handler = async (event, context) => {
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    };

    if (event.httpMethod === "OPTIONS") {
        return {
            statusCode: 200,
            headers,
            body: "",
        };
    }

    try {
        const { telegramId, starsAmount } = JSON.parse(event.body);

        if (!telegramId || starsAmount === undefined) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: "Missing telegramId or starsAmount" }),
            };
        }

        // Получаем текущее значение stars
        const { data: user, error: selectError } = await supabase
            .from('tonjacket')
            .select('stars')
            .eq('telegram_user_id', telegramId)
            .single();

        if (selectError) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ success: false, error: "User not found" }),
            };
        }

        const currentStars = user.stars || 0;
        const newStars = parseFloat((currentStars + parseFloat(starsAmount)).toFixed(3));

        // Обновляем баланс stars
        const { data, error } = await supabase
            .from('tonjacket')
            .update({ stars: newStars })
            .eq('telegram_user_id', telegramId);

        if (error) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ success: false, error: error.message }),
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, newStars }),
        };

    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message }),
        };
    }
};