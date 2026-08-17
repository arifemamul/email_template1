package com.bangla.shobdojot.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bangla.shobdojot.data.Levels
import com.bangla.shobdojot.logic.BanglaText
import com.bangla.shobdojot.model.Level
import com.bangla.shobdojot.ui.theme.DeepIndigo
import com.bangla.shobdojot.ui.theme.LeafGreen
import com.bangla.shobdojot.ui.theme.Marigold
import com.bangla.shobdojot.ui.theme.MidIndigo
import com.bangla.shobdojot.ui.theme.SlateViolet
import com.bangla.shobdojot.ui.theme.TileInk

/** Title, coin count and the level picker. Locked levels show a padlock. */
@Composable
fun HomeScreen(
    coins: Int,
    unlockedLevel: Int,
    isCompleted: (Int) -> Boolean,
    onPlayLevel: (Int) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(DeepIndigo)
            .padding(horizontal = 20.dp, vertical = 16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(Modifier.weight(1f)) {
                Text(
                    text = "শব্দজট",
                    color = Marigold,
                    fontSize = 40.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "অক্ষর জুড়ে বাংলা শব্দ বানাও",
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f),
                    fontSize = 15.sp
                )
            }
            CoinPill(coins)
        }

        Spacer(Modifier.height(20.dp))

        ContinueCard(
            levelId = unlockedLevel.coerceAtMost(Levels.count),
            onClick = { onPlayLevel(unlockedLevel.coerceAtMost(Levels.count)) }
        )

        Spacer(Modifier.height(20.dp))

        Text(
            text = "সব লেভেল",
            color = MaterialTheme.colorScheme.onBackground,
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold
        )

        Spacer(Modifier.height(10.dp))

        LazyVerticalGrid(
            columns = GridCells.Adaptive(minSize = 72.dp),
            contentPadding = PaddingValues(bottom = 24.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
            modifier = Modifier.fillMaxSize()
        ) {
            items(Levels.all, key = { it.id }) { level ->
                LevelTile(
                    level = level,
                    locked = level.id > unlockedLevel,
                    completed = isCompleted(level.id),
                    onClick = { onPlayLevel(level.id) }
                )
            }
        }
    }
}

@Composable
private fun ContinueCard(levelId: Int, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(Marigold)
            .clickable(onClick = onClick)
            .padding(horizontal = 20.dp, vertical = 18.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(Modifier.weight(1f)) {
            Text(
                text = "খেলা শুরু",
                color = TileInk,
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "লেভেল ${BanglaText.digits(levelId)}",
                color = TileInk.copy(alpha = 0.75f),
                fontSize = 15.sp
            )
        }
        Text(text = "▶", color = TileInk, fontSize = 26.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun LevelTile(
    level: Level,
    locked: Boolean,
    completed: Boolean,
    onClick: () -> Unit
) {
    val background = when {
        locked -> MidIndigo
        completed -> LeafGreen
        else -> SlateViolet
    }
    Box(
        modifier = Modifier
            .aspectRatio(1f)
            .clip(RoundedCornerShape(16.dp))
            .background(background)
            .clickable(enabled = !locked, onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        when {
            locked -> Icon(
                Icons.Filled.Lock,
                contentDescription = "বন্ধ",
                tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f)
            )

            else -> Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = BanglaText.digits(level.id),
                    color = if (completed) TileInk else Marigold,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center
                )
                if (completed) {
                    Icon(
                        Icons.Filled.Star,
                        contentDescription = "শেষ",
                        tint = TileInk,
                        modifier = Modifier.height(16.dp)
                    )
                }
            }
        }
    }
}
