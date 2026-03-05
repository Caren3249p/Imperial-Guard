
const { GetNotificationsUseCase } = require('../../../application/usecases/getNotifications.usecase');

let getNotificationsUseCase;

const init = (notificationsRepository) => {
  getNotificationsUseCase = new GetNotificationsUseCase(notificationsRepository);
};

exports.getNotifications = async (req, res) => {
  try {
    const notifications = await getNotificationsUseCase.execute();
    res.json(notifications);
  } catch (error) {
    
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

exports.init = init;
