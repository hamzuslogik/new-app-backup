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
      console.log('[SMS Service] Table fournisseurs_sms n\'existe pas - Utilisation de Manivox par défaut');
      // Fallback vers Manivox avec les identifiants par défaut
      return {
        id: 0,
        nom: 'Manivox',
        login: 'provoicecc@gmail.com',
        api_key: 'x))MTU-e5Ma62y6',
        api_url: 'https://www.manivox.com/api_v2/json_api.php',
        actif: 1
      };
    }

    // Vérifier si la colonne 'actif' existe
    const columnExists = await queryOne(
      `SELECT COUNT(*) as count 
       FROM information_schema.columns 
       WHERE table_schema = DATABASE() 
       AND table_name = 'fournisseurs_sms' 
       AND column_name = 'actif'`
    );
    
    let provider;
    if (columnExists && columnExists.count > 0) {
      // Récupérer le premier fournisseur actif
      provider = await queryOne(
        'SELECT * FROM fournisseurs_sms WHERE actif = 1 ORDER BY id ASC LIMIT 1'
      );
    } else {
      // Si la colonne actif n'existe pas, récupérer le premier fournisseur
      console.log('[SMS Service] Colonne actif n\'existe pas - Récupération du premier fournisseur');
      provider = await queryOne(
        'SELECT * FROM fournisseurs_sms ORDER BY id ASC LIMIT 1'
      );
    }

    if (!provider) {
      console.log('[SMS Service] Aucun fournisseur SMS actif trouvé - Utilisation de Manivox par défaut');
      // Fallback vers Manivox avec les identifiants par défaut
      return {
        id: 0,
        nom: 'Manivox',
        login: 'provoicecc@gmail.com',
        api_key: 'x))MTU-e5Ma62y6',
        api_url: 'https://www.manivox.com/api_v2/json_api.php',
        actif: 1
      };
    }

    // Le login peut être dans 'login' ou 'auth_email' selon la structure de la table
    const providerLogin = provider.login || provider.auth_email;
    
    // Log pour déboguer les données récupérées
    console.log('[SMS Service] Fournisseur récupéré de la base:', {
      id: provider.id,
      nom: provider.nom,
      hasLogin: !!providerLogin,
      hasApiKey: !!provider.api_key,
      hasApiUrl: !!provider.api_url,
      loginField: provider.login ? 'login' : (provider.auth_email ? 'auth_email' : 'AUCUN'),
      loginLength: providerLogin ? providerLogin.length : 0,
      apiKeyLength: provider.api_key ? provider.api_key.length : 0
    });

    // Vérifier que le login (login ou auth_email) et l'api_key sont présents
    if (!providerLogin || !provider.api_key) {
      console.warn('[SMS Service] Fournisseur trouvé mais login/auth_email ou api_key manquant:', {
        id: provider.id,
        nom: provider.nom,
        login: providerLogin || 'MANQUANT',
        api_key: provider.api_key ? 'PRÉSENT' : 'MANQUANT'
      });
      console.log('[SMS Service] Utilisation de Manivox par défaut car credentials manquants');
      console.log('[SMS Service] ⚠️ ATTENTION: Mettez à jour la base de données pour ajouter auth_email au fournisseur Manivox');
      console.log('[SMS Service] Exécutez: UPDATE fournisseurs_sms SET auth_email = \'provoicecc@gmail.com\' WHERE id = ?');
      // Fallback vers Manivox avec les identifiants par défaut
      return {
        id: 0,
        nom: 'Manivox',
        login: 'provoicecc@gmail.com',
        auth_email: 'provoicecc@gmail.com',
        api_key: provider.api_key || 'x))MTU-e5Ma62y6', // Utiliser l'api_key de la base si disponible
        api_url: provider.api_url || 'https://www.manivox.com/api_v2/json_api.php',
        actif: 1
      };
    }

    // S'assurer que le provider a le champ login pour la compatibilité
    if (!provider.login && provider.auth_email) {
      provider.login = provider.auth_email;
    }

    return provider;
  } catch (error) {
    console.error('[SMS Service] Erreur lors de la récupération du fournisseur SMS:', error);
    console.log('[SMS Service] Utilisation de Manivox par défaut en cas d\'erreur');
    // Fallback vers Manivox en cas d'erreur
    return {
      id: 0,
      nom: 'Manivox',
      login: 'provoicecc@gmail.com',
      api_key: 'x))MTU-e5Ma62y6',
      api_url: 'https://www.manivox.com/api_v2/json_api.php',
      actif: 1
    };
  }
}

/**
 * Envoie un SMS via un fournisseur
 * @param {Object} provider - Le fournisseur SMS
 * @param {string} tel - Le numéro de téléphone (format: +33XXXXXXXXX, 0033XXXXXXXXX ou 0XXXXXXXXX)
 * @param {string} message - Le message à envoyer
 * @param {string} from - L'expéditeur (optionnel)
 * @param {Object} ficheData - Données optionnelles de la fiche (nom, prenom, etc.)
 * @returns {Promise<Object>} Résultat de l'envoi
 */
async function sendSMSViaProvider(provider, tel, message, from = 'RAPPEL', ficheData = null) {
  try {
    // Formater le numéro de téléphone en format international +33
    let formattedTel = tel;
    if (tel.startsWith('0')) {
      // Numéro français commençant par 0 : remplacer 0 par +33
      formattedTel = `+33${tel.substring(1)}`;
    } else if (tel.startsWith('0033')) {
      // Numéro déjà en format 0033 : remplacer par +33
      formattedTel = `+33${tel.substring(4)}`;
    } else if (!tel.startsWith('+') && !tel.startsWith('00')) {
      // Numéro sans préfixe : ajouter +33
      formattedTel = `+33${tel}`;
    } else if (tel.startsWith('+')) {
      // Numéro déjà en format international : garder tel quel
      formattedTel = tel;
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
      return await sendViaOctopush(provider, formattedTel, message, from, ficheData);
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
    // Le login peut être dans 'login' ou 'auth_email'
    const login = provider.login || provider.auth_email || '';
    
    // Manivox nécessite généralement le format 0033 (sans le +)
    // Convertir +33 en 0033 si nécessaire
    let manivoxTel = tel;
    if (tel.startsWith('+33')) {
      manivoxTel = `0033${tel.substring(3)}`;
    } else if (tel.startsWith('+')) {
      // Pour les autres pays, remplacer + par 00
      manivoxTel = `00${tel.substring(1)}`;
    }
    
    console.log('[SMS Service] Envoi via Manivox:', {
      telOriginal: tel,
      telFormatted: manivoxTel,
      from: from,
      messageLength: message.length,
      login: login ? login.substring(0, 3) + '***' : 'non défini',
      loginLength: login ? login.length : 0,
      hasAuthEmail: !!provider.auth_email,
      hasLogin: !!provider.login,
      apiKeyLength: provider.api_key ? provider.api_key.length : 0
    });

    if (!login || !provider.api_key) {
      throw new Error('Login (auth_email) et API key Manivox requis');
    }

    // Manivox nécessite api-key et api-login dans les headers
    // Note: provider.api_key (avec underscore) correspond au champ api_key de la table fournisseurs_sms
    // Dans les headers HTTP, on utilise 'api-key' (avec tiret) selon la convention HTTP
    
    // ========== LOGS TEMPORAIRES POUR DEBUG ==========
    const requestParams = {
      action: 'send_sms',
      from: from,
      to: manivoxTel,
      text: message
    };
    
    const requestHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'api-key': provider.api_key,
      'api-login': login,
      'cache-control': 'no-cache'
    };
    
    const fullUrl = `https://www.manivox.com/api_v2/json_api.php?action=${encodeURIComponent(requestParams.action)}&from=${encodeURIComponent(requestParams.from)}&to=${encodeURIComponent(requestParams.to)}&text=${encodeURIComponent(requestParams.text)}`;
    
    console.log('========== REQUÊTE MANIVOX (TEMPORAIRE) ==========');
    console.log('URL complète:', fullUrl);
    console.log('Method: POST');
    console.log('Headers:', JSON.stringify(requestHeaders, null, 2));
    console.log('Headers (valeurs en clair):', {
      'Content-Type': requestHeaders['Content-Type'],
      'Accept': requestHeaders['Accept'],
      'api-key': provider.api_key,
      'api-login': login,
      'cache-control': requestHeaders['cache-control']
    });
    console.log('Params (query string):', JSON.stringify(requestParams, null, 2));
    console.log('==================================================');
    // ========== FIN LOGS TEMPORAIRES ==========
    
    const response = await axios.post('https://www.manivox.com/api_v2/json_api.php', null, {
      params: requestParams,
      headers: requestHeaders,
      timeout: 30000 // 30 secondes de timeout
    });

    const result = response.data;
    console.log('[SMS Service] Réponse Manivox:', JSON.stringify(result));

    const isSuccess = result.message === 'successful';

    // Construire un message d'erreur détaillé
    let errorMessage = 'Erreur inconnue';
    if (!isSuccess) {
      if (result.error) {
        errorMessage = `Erreur Manivox: ${result.error}`;
      } else if (result.message) {
        errorMessage = `Erreur Manivox: ${result.message}`;
      } else if (result.status) {
        errorMessage = `Erreur Manivox: Status ${result.status}`;
      } else {
        errorMessage = `Erreur Manivox: Réponse inattendue - ${JSON.stringify(result)}`;
      }
    }

    return {
      success: isSuccess,
      message: isSuccess ? 'SMS envoyé avec succès' : errorMessage,
      data: result,
      provider: provider.nom,
      error: isSuccess ? null : (result.error || result.message || 'Erreur inconnue')
    };
  } catch (error) {
    console.error('[SMS Service] Erreur Manivox complète:', {
      message: error.message,
      code: error.code,
      response: error.response?.data,
      status: error.response?.status,
      statusText: error.response?.statusText
    });

    let errorMessage = 'Erreur lors de l\'envoi via Manivox';
    
    if (error.response) {
      // Erreur HTTP avec réponse
      const responseData = error.response.data;
      if (responseData && typeof responseData === 'object') {
        errorMessage = responseData.error || responseData.message || `Erreur HTTP ${error.response.status}: ${error.response.statusText}`;
      } else if (responseData) {
        errorMessage = `Erreur HTTP ${error.response.status}: ${responseData}`;
      } else {
        errorMessage = `Erreur HTTP ${error.response.status}: ${error.response.statusText}`;
      }
    } else if (error.request) {
      // Requête envoyée mais pas de réponse
      errorMessage = 'Pas de réponse du serveur Manivox. Vérifiez votre connexion internet.';
    } else if (error.code === 'ECONNABORTED') {
      errorMessage = 'Timeout: Le serveur Manivox n\'a pas répondu dans les temps.';
    } else {
      errorMessage = error.message || 'Erreur inconnue lors de l\'envoi';
    }

    return {
      success: false,
      message: errorMessage,
      error: error.message,
      errorCode: error.code,
      statusCode: error.response?.status,
      provider: provider.nom,
      details: error.response?.data
    };
  }
}

/**
 * Envoie un SMS via Octopush
 * Format fonctionnel testé avec Postman
 * Endpoint: POST https://api.octopush.com/v1/public/sms-campaign/send
 * Authentification: via headers (api-login et api-key)
 */
async function sendViaOctopush(provider, tel, message, from, ficheData = null) {
  try {
    console.log('[SMS Service] Envoi via Octopush:', {
      tel: tel,
      from: from,
      messageLength: message.length,
      login: provider.login ? '***' : 'non défini',
      hasFicheData: !!ficheData
    });

    // URL selon la documentation officielle
    const baseUrl = 'https://api.octopush.com/v1/public';
    const endpoint = '/sms-campaign/send';
    const apiUrl = provider.api_url || `${baseUrl}${endpoint}`;
    
    // Le login peut être dans 'login' ou 'auth_email'
    const login = provider.login || provider.auth_email || '';
    const apiKey = provider.api_key || '';
    
    if (!login || !apiKey) {
      throw new Error('Login (login ou auth_email) et API key Octopush requis');
    }

    // Extraire les données de la fiche si disponibles
    const firstName = ficheData?.prenom || ficheData?.first_name || '';
    const lastName = ficheData?.nom || ficheData?.last_name || '';
    // Déterminer la civilité (Mme, M, etc.) - peut être dans ficheData.civilite ou déduire
    const param3 = ficheData?.civilite || ficheData?.param3 || '';

    // Format du payload selon l'exemple fonctionnel testé avec Postman
    const recipient = {
      phone_number: tel // Format +33XXXXXXXXX ou +216XXXXXXXXX
    };

    // Ajouter les paramètres optionnels si disponibles
    if (firstName) {
      recipient.first_name = firstName;
    }
    if (lastName) {
      recipient.last_name = lastName;
    }
    if (param3) {
      recipient.param3 = param3;
    }

    const requestBody = {
      recipients: [recipient],
      text: message, // Le message peut contenir {{param3}}, {{first_name}}, {{last_name}}
      sender: from || 'RAPPEL'
    };

    console.log('[SMS Service] Requête Octopush:', {
      url: apiUrl,
      body: { ...requestBody, text: requestBody.text.substring(0, 50) + '...' },
      hasAuth: !!(login && apiKey),
      recipient: recipient
    });

    // Headers selon l'exemple fonctionnel
    const response = await axios.post(apiUrl, requestBody, {
      headers: {
        'Content-Type': 'application/json',
        'api-login': login,
        'api-key': apiKey,
        'cache-control': 'no-cache'
      },
      timeout: 30000 // 30 secondes de timeout
    });

    console.log('[SMS Service] Réponse Octopush:', JSON.stringify(response.data, null, 2));

    // Vérifier le statut de la réponse
    const responseData = response.data || {};
    const isSuccess = response.status === 200 || response.status === 201;
    
    // Octopush retourne généralement un code de statut dans la réponse
    // Vérifier les codes de retour possibles selon la documentation
    const statusCode = responseData.code || responseData.status_code;
    const isSuccessByCode = statusCode === 200 || statusCode === 201 || (statusCode >= 200 && statusCode < 300);
    
    const finalSuccess = isSuccess && (isSuccessByCode !== false);

    return {
      success: finalSuccess,
      message: finalSuccess ? 'SMS envoyé avec succès' : (responseData.message || responseData.error || 'Erreur inconnue'),
      data: responseData,
      provider: provider.nom,
      error: finalSuccess ? null : (responseData.error || responseData.message || 'Erreur inconnue'),
      statusCode: response.status,
      apiStatusCode: statusCode
    };
  } catch (error) {
    console.error('[SMS Service] Erreur Octopush complète:', {
      message: error.message,
      code: error.code,
      response: error.response?.data,
      status: error.response?.status,
      statusText: error.response?.statusText
    });

    let errorMessage = 'Erreur lors de l\'envoi via Octopush';
    
    if (error.response) {
      // Erreur HTTP avec réponse
      const responseData = error.response.data;
      if (responseData && typeof responseData === 'object') {
        errorMessage = responseData.error || responseData.message || `Erreur HTTP ${error.response.status}: ${error.response.statusText}`;
      } else if (responseData) {
        errorMessage = `Erreur HTTP ${error.response.status}: ${responseData}`;
      } else {
        errorMessage = `Erreur HTTP ${error.response.status}: ${error.response.statusText}`;
      }
    } else if (error.request) {
      // Requête envoyée mais pas de réponse
      errorMessage = 'Pas de réponse du serveur Octopush. Vérifiez votre connexion internet.';
    } else if (error.code === 'ECONNABORTED') {
      errorMessage = 'Timeout: Le serveur Octopush n\'a pas répondu dans les temps.';
    } else {
      errorMessage = error.message || 'Erreur inconnue lors de l\'envoi';
    }
    
    return {
      success: false,
      message: errorMessage,
      error: error.message,
      errorCode: error.code,
      statusCode: error.response?.status,
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

