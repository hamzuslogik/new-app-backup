const { query, queryOne } = require('../config/database');
const axios = require('axios');

/**
 * Récupère le fournisseur SMS actif par défaut
 * @returns {Promise<Object|null>} Le fournisseur SMS actif ou null
 */
async function getDefaultSMSProvider() {
  try {
    // Vérifier si la table existe
    const tableExists = await queryOne(
      `SELECT COUNT(*) as count 
       FROM information_schema.tables 
       WHERE table_schema = DATABASE() 
       AND table_name = 'fournisseurs_sms'`
    );
    
    if (!tableExists || tableExists.count === 0) {
      console.log('[SMS Service] Table fournisseurs_sms n\'existe pas');
      return null;
    }

    // Récupérer le premier fournisseur actif
    const provider = await queryOne(
      'SELECT * FROM fournisseurs_sms WHERE actif = 1 ORDER BY id ASC LIMIT 1'
    );

    if (!provider) {
      console.log('[SMS Service] Aucun fournisseur SMS actif trouvé');
      return null;
    }

    return provider;
  } catch (error) {
    console.error('[SMS Service] Erreur lors de la récupération du fournisseur SMS:', error);
    return null;
  }
}

/**
 * Envoie un SMS via un fournisseur
 * @param {Object} provider - Le fournisseur SMS
 * @param {string} tel - Le numéro de téléphone (format: 0033XXXXXXXXX ou 0XXXXXXXXX)
 * @param {string} message - Le message à envoyer
 * @param {string} from - L'expéditeur (optionnel)
 * @returns {Promise<Object>} Résultat de l'envoi
 */
async function sendSMSViaProvider(provider, tel, message, from = 'RAPPEL') {
  try {
    // Formater le numéro de téléphone
    let formattedTel = tel;
    if (tel.startsWith('0')) {
      formattedTel = `0033${tel.substring(1)}`;
    } else if (!tel.startsWith('+') && !tel.startsWith('00')) {
      formattedTel = `0033${tel}`;
    }

    // Détecter le type de fournisseur par le nom ou l'URL
    const providerName = (provider.nom || '').toLowerCase();
    const apiUrl = provider.api_url || '';

    // Manivox
    if (providerName.includes('manivox') || apiUrl.includes('manivox')) {
      return await sendViaManivox(provider, formattedTel, message, from);
    }
    
    // Octopush
    if (providerName.includes('octopush') || apiUrl.includes('octopush')) {
      return await sendViaOctopush(provider, formattedTel, message, from);
    }

    // Twilio
    if (providerName.includes('twilio') || apiUrl.includes('twilio')) {
      return await sendViaTwilio(provider, formattedTel, message, from);
    }

    // API générique (essayer avec les paramètres du fournisseur)
    return await sendViaGenericAPI(provider, formattedTel, message, from);

  } catch (error) {
    console.error('[SMS Service] Erreur lors de l\'envoi du SMS:', error);
    throw error;
  }
}

/**
 * Envoie un SMS via Manivox
 */
async function sendViaManivox(provider, tel, message, from) {
  try {
    const response = await axios.post('https://www.manivox.com/api_v2/json_api.php', null, {
      params: {
        action: 'send_sms',
        auth_email: provider.login || '',
        auth_password: provider.api_key || '',
        from: from,
        to: tel,
        text: message
      }
    });

    const result = response.data;
    const isSuccess = result.message === 'successful';

    return {
      success: isSuccess,
      message: isSuccess ? 'SMS envoyé avec succès' : result.message || 'Erreur inconnue',
      data: result,
      provider: provider.nom
    };
  } catch (error) {
    console.error('[SMS Service] Erreur Manivox:', error);
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Erreur lors de l\'envoi via Manivox',
      error: error.message,
      provider: provider.nom
    };
  }
}

/**
 * Envoie un SMS via Octopush
 */
async function sendViaOctopush(provider, tel, message, from) {
  try {
    // Octopush API v1 - Format standard
    const apiUrl = provider.api_url || 'https://api.octopush.com/v1/public/sms-campaign/send';
    
    // Construire l'URL avec les paramètres d'authentification
    const login = provider.login || '';
    const apiKey = provider.api_key || '';
    
    // Octopush utilise généralement l'authentification via paramètres URL ou headers
    const response = await axios.post(apiUrl, {
      text: message,
      recipients: [tel],
      type: 'sms_premium',
      sender: from
    }, {
      params: {
        user_login: login,
        api_key: apiKey
      },
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const isSuccess = response.status === 200 || response.status === 201;
    
    return {
      success: isSuccess,
      message: isSuccess ? 'SMS envoyé avec succès' : (response.data?.error || 'Erreur inconnue'),
      data: response.data,
      provider: provider.nom
    };
  } catch (error) {
    console.error('[SMS Service] Erreur Octopush:', error);
    const errorMessage = error.response?.data?.error || 
                        error.response?.data?.message || 
                        error.message || 
                        'Erreur lors de l\'envoi via Octopush';
    
    return {
      success: false,
      message: errorMessage,
      error: error.message,
      provider: provider.nom,
      details: error.response?.data
    };
  }
}

/**
 * Envoie un SMS via Twilio
 */
async function sendViaTwilio(provider, tel, message, from) {
  try {
    const apiUrl = provider.api_url || `https://api.twilio.com/2010-04-01/Accounts/${provider.login}/Messages.json`;
    
    const response = await axios.post(apiUrl, new URLSearchParams({
      To: tel,
      From: from,
      Body: message
    }), {
      auth: {
        username: provider.login || '',
        password: provider.api_key || ''
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    return {
      success: response.status === 200 || response.status === 201,
      message: 'SMS envoyé avec succès',
      data: response.data,
      provider: provider.nom
    };
  } catch (error) {
    console.error('[SMS Service] Erreur Twilio:', error);
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Erreur lors de l\'envoi via Twilio',
      error: error.message,
      provider: provider.nom
    };
  }
}

/**
 * Envoie un SMS via une API générique
 * Essaie d'utiliser l'URL et les credentials du fournisseur
 */
async function sendViaGenericAPI(provider, tel, message, from) {
  try {
    const apiUrl = provider.api_url;
    
    if (!apiUrl) {
      throw new Error('URL API non définie pour le fournisseur');
    }

    // Essayer avec POST et les paramètres standards
    const response = await axios.post(apiUrl, {
      tel: tel,
      to: tel,
      message: message,
      text: message,
      from: from,
      sender: from
    }, {
      auth: {
        username: provider.login || '',
        password: provider.api_key || ''
      },
      headers: {
        'Content-Type': 'application/json'
      }
    });

    return {
      success: response.status === 200 || response.status === 201,
      message: 'SMS envoyé avec succès',
      data: response.data,
      provider: provider.nom
    };
  } catch (error) {
    console.error('[SMS Service] Erreur API générique:', error);
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Erreur lors de l\'envoi via l\'API',
      error: error.message,
      provider: provider.nom
    };
  }
}

module.exports = {
  getDefaultSMSProvider,
  sendSMSViaProvider
};

