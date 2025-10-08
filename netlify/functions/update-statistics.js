import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
        const { telegramUserId, betAmount, winAmount, isWin } = JSON.parse(event.body);

        if (!telegramUserId || betAmount === undefined) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing required fields: telegramUserId, betAmount' })
            };
        }

        // Используем UPSERT для вставки или обновления записи
        const updates = {
            telegram_user_id: telegramUserId,
            updated_at: new Date().toISOString()
        };

        // Получаем текущие значения если запись существует
        const { data: existingStat, error: selectError } = await supabase
            .from('statistics')
            .select('*')
            .eq('telegram_user_id', telegramUserId)
            .maybeSingle();

        if (selectError && selectError.code !== 'PGRST116') { // PGRST116 - no rows
            throw selectError;
        }

        // Рассчитываем новые значения
        if (existingStat) {
            // Обновляем существующую запись
            updates.total_bet = (parseFloat(existingStat.total_bet) || 0) + parseFloat(betAmount);
            
            if (isWin) {
                updates.total_won = (parseFloat(existingStat.total_won) || 0) + parseFloat(winAmount);
                updates.total_lost = parseFloat(existingStat.total_lost) || 0;
            } else {
                updates.total_won = parseFloat(existingStat.total_won) || 0;
                updates.total_lost = (parseFloat(existingStat.total_lost) || 0) + parseFloat(betAmount);
            }
        } else {
            // Создаем новую запись
            updates.total_bet = parseFloat(betAmount);
            updates.total_won = isWin ? parseFloat(winAmount) : 0;
            updates.total_lost = isWin ? 0 : parseFloat(betAmount);
            updates.created_at = new Date().toISOString();
        }

        // Выполняем UPSERT
        const { data, error } = await supabase
            .from('statistics')
            .upsert(updates, { 
                onConflict: 'telegram_user_id',
                ignoreDuplicates: false 
            })
            .select()
            .single();

        if (error) {
            throw error;
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true, 
                data: data,
                message: 'Statistics updated successfully'
            })
        };

    } catch (error) {
        console.error('Error in update-statistics function:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error: ' + error.message })
        };
    }
};