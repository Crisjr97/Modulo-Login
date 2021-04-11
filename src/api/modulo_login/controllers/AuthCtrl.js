const jwt = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');

const { getEmail, postToken, getUsuario, postPassword, limpiarToken } = require('../model/users');
const { generarJWT, generarJwtPassword } = require('../helpers/generar-jwt');
const transporter = require('../config/meiler');

const login = async (req, res) => {
	const correo = req.body.correo;
	const password = req.body.password;

	try {
		// Modelo de datos de usuario
		const usuario = await getEmail(correo);

		// Verificar si el correo existe
		if (usuario === undefined) {
			return res.status(400).json({ error: 'El usuario o la contraseña son invalidos' });
		}

		// Si el usuario esta activo
		if (usuario.indicador_usuario !== 'activo') {
			return res.status(400).json({ error: `El usuario con este email: ${correo} no existe!!` });
		}

		// Verificar la contraseña
		const validarPassword = bcryptjs.compareSync(password, usuario.password);
		if (!validarPassword) {
			return res.status(400).json({ error: 'El usuario o la contraseña son invalidos' });
		}

		// Generar el token
		const token = await generarJWT(usuario.id_usuario, usuario.id_rol, usuario.indicador_usuario);

		res.status(200).json({ message: 'Inicio de sesión correcto', token: token });
	} catch (error) {
		console.log(error);
		return res.status(500).json({ error: 'Hable con el administrador' });
	}
	//    Fin try-catch
};

const recuperarPassword = async (req, res) => {
	const correo = req.body.correo;

	const message = 'Revise su correo electrónico que contiene el enlace para restablecer su contraseña';
	let verificarLink;
	let usuario;
	try {
		// Modelo de datos de usuario
		usuario = await getEmail(correo);

		// Verificar si el correo existe
		if (usuario === undefined) {
			return res.status(400).json({ error: 'El usuario es incorrecto' });
		}

		// Si el usuario esta activo
		if (usuario.indicador_usuario !== 'activo') {
			return res.status(400).json({ error: `El usuario con este email: ${correo} no existe!!` });
		}

		// // Generar el token
		const token = await generarJwtPassword(usuario.id_usuario, usuario.user, usuario.indicador_usuario);

		// Generar la url para actualizar la contraseña
		verificarLink = `http://${req.headers.host}/auth/new_password/${token}`;
		// console.log(verificarLink);

		// Guardar el token en la Base de Datos
		await postToken(token, usuario.id_usuario);

		res.status(200).json({ message: message, url: verificarLink });
	} catch (error) {
		console.log(error);
		return res.status(500).json({ message: 'Hable con el Administrador' });
	}
	//    Fin try-catch

	try {
		// Enviamos el email
		await transporter.sendMail({
			from: '"Cambiar Credenciales " <encoders@gmail.com>',
			to: usuario.correo,
			subject: 'Cambiar Credenciales',
			text: 'Hello world?',
			html: ` 
            <center>
                <img src='https://cdn.icon-icons.com/icons2/2072/PNG/512/internet_lock_locked_padlock_password_secure_security_icon_127100.png'
                    width='150px' heigth='150px'>
                <h1 style='font-size:30px; color:black;'>Cambio de Credenciales</h1>
                <h3 style='font-size:20px; color:black;'><strong>¿Has solicitado cambio de contraseña?</strong></h3>
                <h3><a style="background-color: #007bff; padding: 10px; border-radius: 5px; color: white; text-decoration: none;"
                        href='${verificarLink}'>INGRESAR
                        AQUÍ</a></h3>
                <h4 style='color:black;'>Si no requieres cambio de contraseña o no has sido quien lo ha
                    solicitado,<br>simplemente
                    ignora este mensaje!</h4>
                <h4>Contacto: Perla Casco, Directora Ejecutiva<br>#: (+504)2283-0967 | (+504)8824-2342</h4>
            </center>`,
		});
	} catch (error) {
		console.log(error);
		return res.status(500).json({ message: 'Hable con el Administrador' });
	}
};

const newPassword = async (req, res) => {
	// Validación para revisar que venga el token
	const { token } = req.params;
	const password = req.body.password;

	if (!token) {
		return res.status(400).json({ message: 'No tiene Autorización' });
	}

	try {
		// Verificar el token del url y extraer el uid
		const { uid } = jwt.verify(token, process.env.SECRETKEYRESETPASSWOR);
		console.log(uid);
		if (!uid) {
			return res.status(400).json({ message: 'El usuario no existe' });
		}
		// Verificar si uid del token existe en la BD
		const usuario = await getUsuario(uid);
		if (!usuario) {
			return res.status(400).json({ message: 'El usuario no existe' });
		}

		// Verificamos si existe el token en la BD
		if (!usuario.token_password) {
			return res.status(401).json({
				msg: 'No tienes autorización para estar aqui!!',
			});
		}

		// verificar que el token de la ruta sea igual al de la base de datos
		if (token !== usuario.token_password) {
			return res.status(401).json({
				msg: 'No tienes autorización para estar aqui!!',
			});
		}

		// Verificar si el uid tiene estado act
		if (usuario.indicador_usuario !== 'activo') {
			return res.status(401).json({
				msg: 'El usuario no existe',
			});
		}

		// // Encriptar la nueva contraseña
		const salt = bcryptjs.genSaltSync();
		const newPassword = bcryptjs.hashSync(password, salt);
		// console.log(newPassword);

		// Guardar la nueva contraseña en la BD
		await postPassword(newPassword, usuario.id_usuario);

		// // Limpiamos el token_password de la BD
		const tokenPass = null;
		await limpiarToken(tokenPass, usuario.id_usuario);

		res.status(200).json({ message: 'Contraseña restablecida correctamente' });
	} catch (error) {
		console.log(error);
		return res.status(500).json({ error: 'Hable con el administrador' });
	}
	//    Fin try-catch
};

const newPassword2 = async (req, res) => {
	// Validación para revisar que venga el token
	if (!req.headers.authorization) {
		return res.status(400).json({ message: 'No tiene Autorización' });
	}
	const password = req.body.password;
	const resetToken = req.headers.authorization.split(' ')[1];

	try {
		// Verificar el token del url y extraer el uid
		const { uid } = jwt.verify(resetToken, process.env.SECRETKEYRESETPASSWOR);

		if (!uid) {
			return res.status(400).json({ message: 'El usuario no existe' });
		}

		// Verificar si uid del token existe en la BD
		const usuario = await getUsuario(uid);
		if (!usuario) {
			return res.status(400).json({ message: 'El usuario no existe' });
		}

		// Verificamos si existe el token en la BD
		if (!usuario.token_password) {
			return res.status(401).json({
				msg: 'No tienes autorización para estar aqui!!',
			});
		}

		// Verificar si el uid tiene estado act
		if (usuario.indicador_usuario !== 'activo') {
			return res.status(401).json({
				msg: 'El usuario no existe',
			});
		}

		// Encriptar la nueva contraseña
		const salt = bcryptjs.genSaltSync();
		const newPassword = bcryptjs.hashSync(password, salt);
		// console.log(newPassword);

		// Guardar la nueva contraseña en la BD
		await postPassword(newPassword, usuario.id_usuario);

		// Limpiamos el token_password de la BD
		const token = null;
		await limpiarToken(token, usuario.id_usuario);

		res.status(200).json({ message: 'Contraseña restablecida correctamente' });
	} catch (error) {
		console.log(error);
		return res.status(500).json({ error: 'Hable con el administrador' });
	}
	//    Fin try-catch
};

module.exports = {
	login,
	recuperarPassword,
	newPassword,
	newPassword2,
};
