package com.bangla.shobdojot.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import com.bangla.shobdojot.R

/**
 * Noto Sans Bengali is bundled rather than borrowed from the device. Android has shipped a
 * Bengali font for years, but OEM builds vary and a stripped ROM with no Bengali coverage
 * would turn every tile into an empty box — the one failure this game cannot survive.
 * Bundling also means the letterforms match the web build exactly.
 *
 * Licence: SIL Open Font License 1.1, see `assets/fonts/OFL.txt`.
 */
val BanglaFontFamily = FontFamily(
    Font(R.font.noto_sans_bengali_regular, FontWeight.Normal),
    Font(R.font.noto_sans_bengali_bold, FontWeight.Bold)
)

/**
 * Material 3 has no single "default font family" hook, so the family is applied to every
 * style in the scale. Anything drawing text through the theme then gets Bengali coverage,
 * including Material's own dialog text.
 */
val BanglaTypography: Typography = Typography().run {
    Typography(
        displayLarge = displayLarge.copy(fontFamily = BanglaFontFamily),
        displayMedium = displayMedium.copy(fontFamily = BanglaFontFamily),
        displaySmall = displaySmall.copy(fontFamily = BanglaFontFamily),
        headlineLarge = headlineLarge.copy(fontFamily = BanglaFontFamily),
        headlineMedium = headlineMedium.copy(fontFamily = BanglaFontFamily),
        headlineSmall = headlineSmall.copy(fontFamily = BanglaFontFamily),
        titleLarge = titleLarge.copy(fontFamily = BanglaFontFamily),
        titleMedium = titleMedium.copy(fontFamily = BanglaFontFamily),
        titleSmall = titleSmall.copy(fontFamily = BanglaFontFamily),
        bodyLarge = bodyLarge.copy(fontFamily = BanglaFontFamily),
        bodyMedium = bodyMedium.copy(fontFamily = BanglaFontFamily),
        bodySmall = bodySmall.copy(fontFamily = BanglaFontFamily),
        labelLarge = labelLarge.copy(fontFamily = BanglaFontFamily),
        labelMedium = labelMedium.copy(fontFamily = BanglaFontFamily),
        labelSmall = labelSmall.copy(fontFamily = BanglaFontFamily)
    )
}
