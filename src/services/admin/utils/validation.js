function isValidPassword(password) {
  if (password.length < 8) return false;

  let hasLetter = false;
  let hasDigit = false;
  let hasSpecial = false;
  const specialChars = '.,/^@$!%*?&';

  for (const char of password) {
    if (/[a-zA-Z]/.test(char)) hasLetter = true;
    else if (/[0-9]/.test(char)) hasDigit = true;
    else if (specialChars.includes(char)) hasSpecial = true;
  }

  return hasLetter && hasDigit && hasSpecial;
}

function isValidName(name) {
  return name.length >= 1 && name.length <= 50;
}

function isAlphabetical(name) {
  return /^[A-Za-z]+$/.test(name);
}

function isValidUsername(username) {
  return /^[a-zA-Z0-9-]{3,20}$/.test(username);
}

function isValidPhoneNumber(phoneNumber) {
  const regex = /^(?:\+84)(?:3[2-9]|5[689]|7[06-9]|8[1-5]|9[0-9])[0-9]{7}$/;
  return regex.test(phoneNumber);
}

export {
  isValidPassword,
  isValidName,
  isAlphabetical,
  isValidUsername,
  isValidPhoneNumber,
};
