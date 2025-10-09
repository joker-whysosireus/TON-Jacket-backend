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

        // Получаем данные пользователя из базы tonjacket
        const userResponse = await fetch(`${SUPABASE_URL}/rest/v1/tonjacket?telegram_user_id=eq.${userId}&select=*`, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!userResponse.ok) {
            throw new Error('Failed to fetch user data');
        }

        const userData = await userResponse.json();
        const user = userData[0];

        // Получаем статистику пользователя из таблицы statistics
        const statsResponse = await fetch(`${SUPABASE_URL}/rest/v1/statistics?telegram_user_id=eq.${userId}&select=*`, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        let totalWon = 0;
        let totalLost = 0;
        
        if (statsResponse.ok) {
            const statsData = await statsResponse.json();
            if (statsData.length > 0) {
                totalWon = parseFloat(statsData[0].total_won) || 0;
                totalLost = parseFloat(statsData[0].total_lost) || 0;
            }
        }

        const username = user?.telegram_username || user?.first_name || 'Неизвестно';
        const betAmount = user?.bet_amount || 0;
        const withdrawAmount = user?.withdraw_amount || 0; // Получаем текущее значение withdraw_amount

        // Получаем текущую дату в формате "число месяц"
        const now = new Date();
        const months = [
            'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
            'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
        ];
        const day = now.getDate();
        const month = months[now.getMonth()];
        const timeString = `${day} ${month}`;

        // Уведомление пользователю
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: userId,
                text: `══════════════════\n` +
                      `*WITHDRAWAL REQUEST*\n` +
                      `══════════════════\n\n` +
                      `*Amount:* ${amount} TON\n` +
                      `*Wallet:* \`${walletAddress}\`\n\n` +
                      `*Status:* Processing...\n\n` +
                      `══════════════════\n` +
                      `You will receive a notification from your wallet when the transaction is completed.`,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[
                        {
                            text: '🎰Spin!',
                            web_app: { url: 'https://ton-jacket.netlify.app/' }
                        }
                    ]]
                }
            })
        });

        // Уведомление создателю на русском с полной статистикой
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: CREATOR_ID,
                text: `══════════════════\n` +
                      `   🔄 *НОВЫЙ ЗАПРОС НА ВЫВОД*\n` +
                      `══════════════════\n\n` +
                      `👤 *Пользователь:* ${username}\n` +
                      `🆔 *ID:* ${userId}\n` +
                      `💎 *Сумма вывода:* ${amount} TON\n` +
                      `👛 *Кошелек:* \`${walletAddress}\`\n\n` +
                      `📊 *СТАТИСТИКА ИГРОКА:*\n` +
                      `🎰 *Всего ставок:* ${betAmount} TON\n` +
                      `💰 *Всего выиграл:* ${totalWon.toFixed(2)} TON\n` +
                      `💸 *Всего проиграл:* ${totalLost.toFixed(2)} TON\n` +
                      `📈 *Баланс:* ${(totalWon - totalLost).toFixed(2)} TON\n` +
                      `💳 *Уже выведено:* ${withdrawAmount.toFixed(2)} TON\n\n` +
                      `⏰ *Время:* ${timeString}`,
                parse_mode: 'Markdown'
            })
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true,
                message: 'Withdrawal notification sent successfully'
            })
        };

    } catch (error) {
        console.error('Error in withdraw-notification function:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error: ' + error.message })
        };
    }
};