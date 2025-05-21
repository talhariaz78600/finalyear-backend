const phoneUtil = require('google-libphonenumber').PhoneNumberUtil.getInstance();
const { PhoneNumberFormat } = require('google-libphonenumber');

const validateAndFormatPhoneNumber = (contact, countryCode) => {
  try {
    const countryDialCode = parseInt(countryCode?.replace('+', ''), 10);
    const regionCode = phoneUtil.getRegionCodeForCountryCode(countryDialCode);
    if (!regionCode) throw new Error('Invalid country code.');

    const number = phoneUtil.parseAndKeepRawInput(contact, regionCode);
    if (!phoneUtil.isValidNumber(number) || !phoneUtil.isValidNumberForRegion(number, regionCode)) {
      throw new Error(`Invalid ${contact} number for the specified country.`);
    }

    return phoneUtil.format(number, PhoneNumberFormat.E164);
  } catch (error) {
    throw new Error(error.message);
  }
};

module.exports = { validateAndFormatPhoneNumber };
