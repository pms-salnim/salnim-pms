
const units = ["", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf"];
const teens = ["dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
const tens = ["", "dix", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante-dix", "quatre-vingt", "quatre-vingt-dix"];

function numberToWords(n: number): string {
    if (n < 10) return units[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) {
        const ten = Math.floor(n / 10);
        const unit = n % 10;
        if (ten === 7 || ten === 9) {
            return tens[ten - 1] + "-" + teens[unit];
        }
        const unitWord = unit > 0 ? (unit === 1 && ten !== 8 ? "-et-" : "-") + units[unit] : "";
        let result = tens[ten];
        if (result === 'vingt' && unit > 0) result += '-';
        if (result === 'quatre-vingt' && unit === 0) result = result.slice(0, -1);
        return result + unitWord;
    }
    if (n < 1000) {
        const hundred = Math.floor(n / 100);
        const rest = n % 100;
        const hundredWord = hundred > 1 ? units[hundred] + "-cent" : "cent";
        if (rest === 0 && hundred > 1) return hundredWord + "s";
        return hundredWord + (rest > 0 ? " " + numberToWords(rest) : "");
    }
    if (n < 1000000) {
        const thousand = Math.floor(n / 1000);
        const rest = n % 1000;
        const thousandWord = thousand > 1 ? numberToWords(thousand) + "-mille" : "mille";
        return thousandWord + (rest > 0 ? " " + numberToWords(rest) : "");
    }
    return n.toString();
}

export function toWordsFr(num: number): string {
  if (num === 0) return "zéro";
  return numberToWords(num);
}
